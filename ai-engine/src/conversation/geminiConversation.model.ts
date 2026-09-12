import { createConversationPrompt } from "./conversationPrompt.builder.js";
import type {
  AgentDecision,
  ConversationAgentRequest,
} from "./conversationAgent.types.js";
import {
  decideConversationInteraction,
  safeTargetLabel,
  validateConversationInteractionDecision,
} from "./conversationInteraction.policy.js";
import type { ConversationModelPort } from "./conversationModel.port.js";

export interface GeminiConversationTransportInput {
  prompt: string;
}

/** Injectable so contract tests and local development never require a Gemini key. */
export type GeminiConversationTransport = (
  input: GeminiConversationTransportInput,
) => Promise<string>;

export class GeminiConversationContractError extends Error {
  constructor(
    public readonly code: "INVALID_JSON" | "INVALID_DECISION",
    message: string,
  ) {
    super(message);
    this.name = "GeminiConversationContractError";
  }
}

/**
 * C-08 contract boundary for a future Gemini-backed ConversationModelPort.
 * Production routing stays scripted until an explicitly configured transport is wired.
 */
export class GeminiConversationModel implements ConversationModelPort {
  constructor(private readonly transport: GeminiConversationTransport) {}

  async decide(input: ConversationAgentRequest): Promise<AgentDecision> {
    const basePrompt = createConversationPrompt(input);
    let lastError: GeminiConversationContractError | null = null;
    for (let attempt = 0; attempt < 2; attempt += 1) {
      const prompt = attempt === 0
        ? basePrompt
        : `${basePrompt}\n\nYour previous response was rejected: ${lastError?.message}. Return one corrected JSON object only.`;
      const raw = await this.transport({ prompt });
      let candidate: unknown;
      try {
        candidate = JSON.parse(extractJson(raw));
      } catch {
        lastError = new GeminiConversationContractError(
          "INVALID_JSON",
          "Gemini conversation output was not valid JSON.",
        );
        continue;
      }

      const normalized = normalizeModelDecision(input, candidate);
      const validation = validateConversationInteractionDecision(input, normalized);
      if (validation.valid) return normalized as AgentDecision;
      lastError = new GeminiConversationContractError(
        "INVALID_DECISION",
        `Gemini conversation output violated the contract: ${validation.errors.join("; ")}`,
      );
    }
    throw lastError ?? new GeminiConversationContractError(
      "INVALID_DECISION",
      "Gemini conversation output could not be validated.",
    );
  }
}

const SNAPSHOT_MODES = new Set([
  "AUTO_EXECUTE",
  "GUIDE_USER",
  "INFORM_USER",
  "SECURE_INPUT_REQUIRED",
  "RISK_WARNING",
  "FINAL_CONFIRMATION_REQUIRED",
  "COMPLETE",
]);

/** The model proposes semantics; trusted request and DOM data own wire identity. */
function normalizeModelDecision(
  input: ConversationAgentRequest,
  value: unknown,
): unknown {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;
  const raw = value as Record<string, unknown>;
  const mode = typeof raw.mode === "string" ? raw.mode : raw.mode;
  const normalizedQuestion = mode === "ASK_USER"
    ? normalizeQuestion(raw.question)
    : null;
  const normalized: Record<string, unknown> = {
    ...raw,
    requestId: input.requestId,
    requestMessageId: input.requestMessageId,
    goalId: input.goal.goalId,
    baseGoalRevision: input.goal.revision,
    message: raw.message ?? null,
    confidence: typeof raw.confidence === "number" && Number.isFinite(raw.confidence)
      ? Math.max(0, Math.min(1, raw.confidence))
      : 0.5,
    reasonCode: typeof raw.reasonCode === "string" && raw.reasonCode.trim()
      ? raw.reasonCode.trim()
      : "MODEL_DECISION",
    nextCondition: mode === "GOAL_PATCH_PROPOSED" ? "LATEST_DOM_DECISION" : null,
    sourceSnapshotId: typeof mode === "string" && SNAPSHOT_MODES.has(mode)
      ? input.snapshot?.sourceSnapshotId ?? null
      : null,
    goalPatch: mode === "ASK_USER" || mode === "GOAL_PATCH_PROPOSED"
      ? normalizeGoalPatch(input, raw.goalPatch, normalizedQuestion)
      : null,
    question: normalizedQuestion,
    actionCandidate: null,
  };

  if ((mode === "AUTO_EXECUTE" || mode === "GUIDE_USER") &&
      raw.actionCandidate && typeof raw.actionCandidate === "object" &&
      !Array.isArray(raw.actionCandidate)) {
    const action = raw.actionCandidate as Record<string, unknown>;
    const { inputValue: proposedInputValue, ...actionWithoutInput } = action;
    const targetId = typeof action.targetElementId === "string"
      ? action.targetElementId
      : null;
    const matches = input.snapshot?.sanitizedDomSnapshot.elements.filter(
      (element) => element.elementId === targetId,
    ) ?? [];
    const target = matches.length === 1 ? matches[0] : null;
    const label = target ? safeTargetLabel(target) : null;
    const message = normalized.message;
    normalized.actionCandidate = {
      ...actionWithoutInput,
      targetElementId: targetId,
      role: target?.role?.toLowerCase() ?? action.role,
      accessibleLabel: label ?? action.accessibleLabel,
      guide: typeof message === "string" ? message : action.guide,
      ...(action.actionType === "TYPE"
        ? { inputValue: proposedInputValue ?? null }
        : {}),
    };
  }
  return normalized;
}

function normalizeQuestion(value: unknown): { fieldKey: string } | null {
  if (typeof value === "string" && value.trim()) {
    return { fieldKey: value.trim() };
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const fieldKey = (value as Record<string, unknown>).fieldKey;
  return typeof fieldKey === "string" && fieldKey.trim()
    ? { fieldKey: fieldKey.trim() }
    : null;
}

function normalizeGoalPatch(
  input: ConversationAgentRequest,
  value: unknown,
  question: unknown,
): unknown {
  const raw = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
  const fieldKey = question && typeof question === "object" && !Array.isArray(question)
    ? (question as Record<string, unknown>).fieldKey
    : null;
  return {
    ...raw,
    basedOnRevision: input.goal.revision,
    ...(raw.missingFields === undefined && typeof fieldKey === "string"
      ? { missingFields: [fieldKey] }
      : {}),
  };
}

/** Keeps non-negotiable security boundaries deterministic, while all ordinary
 * navigation decisions remain model-driven and site-agnostic. */
export class SafetyBoundConversationModel implements ConversationModelPort {
  constructor(private readonly delegate: ConversationModelPort) {}

  decide(input: ConversationAgentRequest): Promise<AgentDecision> {
    if (input.snapshot) {
      const protectedDecision = decideConversationInteraction(input);
      if ([
        "SECURE_INPUT_REQUIRED",
        "RISK_WARNING",
        "FINAL_CONFIRMATION_REQUIRED",
      ].includes(protectedDecision.mode)) {
        return Promise.resolve(protectedDecision);
      }
    }
    return this.delegate.decide(input);
  }
}

function extractJson(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/iu.exec(trimmed);
  return fenced?.[1]?.trim() ?? trimmed;
}
