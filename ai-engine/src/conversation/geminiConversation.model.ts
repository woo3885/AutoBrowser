import { createConversationPrompt } from "./conversationPrompt.builder.js";
import type {
  AgentDecision,
  ConversationAgentRequest,
} from "./conversationAgent.types.js";
import { validateConversationInteractionDecision } from "./conversationInteraction.policy.js";
import { decideConversationInteraction } from "./conversationInteraction.policy.js";
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

      const validation = validateConversationInteractionDecision(input, candidate);
      if (validation.valid) return candidate as AgentDecision;
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
