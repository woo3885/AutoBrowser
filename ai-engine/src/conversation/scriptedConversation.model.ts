import type {
  AgentDecision,
  ConversationAgentRequest,
  UserGoalPatch,
} from "./conversationAgent.types.js";
import type { ConversationModelPort } from "./conversationModel.port.js";
import {
  extractInitialGoalPatch,
  mergeGoalAnswer,
  questionMessage,
  type GoalPatchExtractionResult,
} from "./userGoalPatch.extractor.js";
import {
  decideConversationInteraction,
} from "./conversationInteraction.policy.js";
import {
  SAFE_INTERNAL_MESSAGE,
  sanitizeDecisionLabel,
  sanitizeInternalMessage,
} from "../messages/messageSafety.js";

export interface CurrentPageAnalysisTransportInput {
  prompt: string;
}

export type CurrentPageAnalysisTransport = (
  input: CurrentPageAnalysisTransportInput,
) => Promise<string>;

const CURRENT_PAGE_ANALYSIS =
  /(?:현재\s*(?:사이트|화면|페이지).*(?:분석|설명|알려)|(?:분석|설명)해\s*줘)/u;

export class ScriptedConversationModel implements ConversationModelPort {
  async decide(input: ConversationAgentRequest): Promise<AgentDecision> {
    if (
      input.snapshot !== null &&
      (input.goal.intent === "DEPOSIT" || input.goal.intent === "INQUIRY") &&
      input.goal.missingFields.length === 0 &&
      input.goal.pendingQuestion === null
    ) {
      return decideConversationInteraction(input);
    }
    const result = input.goal.pendingQuestion === null
      ? extractInitialGoalPatch(input.goal, input.userMessage.content)
      : mergeGoalAnswer(input.goal, input.userMessage.content);
    return toDecision(input, result);
  }
}

/**
 * Keeps the deterministic safety policy authoritative while allowing a
 * production-only language model to describe the current sanitized page.
 */
export class PageAwareConversationModel implements ConversationModelPort {
  constructor(
    private readonly delegate: ConversationModelPort,
    private readonly analyze: CurrentPageAnalysisTransport,
  ) {}

  async decide(input: ConversationAgentRequest): Promise<AgentDecision> {
    const protectedGoal = input.goal.safety.secureInputActive ||
      input.goal.safety.riskState !== "NONE" ||
      input.goal.safety.confirmationState !== "NONE";
    const protectedPage = input.snapshot?.sanitizedDomSnapshot.elements.some(
      (element) => element.visible &&
        ["SECURE_INPUT", "FINAL_CONFIRMATION", "BLOCKED"].includes(element.securityPolicy),
    ) ?? false;
    if (
      !input.snapshot ||
      protectedGoal ||
      protectedPage ||
      !CURRENT_PAGE_ANALYSIS.test(input.userMessage.content)
    ) {
      return this.delegate.decide(input);
    }

    const fallback = summarizeCurrentPage(input);
    let message = fallback;
    try {
      const generated = await withAnalysisTimeout(this.analyze({
        prompt: createCurrentPageAnalysisPrompt(input),
      }));
      const safe = sanitizeInternalMessage(generated);
      if (safe !== SAFE_INTERNAL_MESSAGE) message = safe;
    } catch {
      // A model outage must not terminate an otherwise healthy browser session.
    }

    return {
      ...baseDecision(input),
      mode: "INFORM_USER",
      message,
      reasonCode: "CURRENT_PAGE_ANALYSIS",
      sourceSnapshotId: input.snapshot.sourceSnapshotId,
    };
  }
}

async function withAnalysisTimeout<T>(operation: Promise<T>): Promise<T> {
  let timeout: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<T>((_resolve, reject) => {
        timeout = setTimeout(() => reject(new Error("PAGE_ANALYSIS_TIMEOUT")), 3_000);
      }),
    ]);
  } finally {
    if (timeout) clearTimeout(timeout);
  }
}

function createCurrentPageAnalysisPrompt(input: ConversationAgentRequest): string {
  const snapshot = input.snapshot!;
  const elements = snapshot.sanitizedDomSnapshot.elements
    .filter((element) =>
      element.visible &&
      !["SECURE_INPUT", "BLOCKED"].includes(element.securityPolicy),
    )
    .slice(0, 20)
    .map((element) => ({
      role: element.role,
      label: element.ariaLabel ?? element.text ?? element.placeholder,
      enabled: element.enabled,
    }));
  const context = {
    title: snapshot.sanitizedDomSnapshot.page.title,
    productName: snapshot.sanitizedDomSnapshot.page.productName,
    elements,
  };
  return [
    "현재 데모 금융 화면을 사용자가 이해하기 쉬운 한국어 한 문장으로 설명하세요.",
    "화면에 실제로 있는 정보만 말하고 클릭, 선택, 입력 또는 거래를 실행했다고 표현하지 마세요.",
    "비밀번호, OTP, 계좌번호, 내부 ID, URL, selector는 절대 포함하지 마세요.",
    JSON.stringify(context),
  ].join("\n");
}

function summarizeCurrentPage(input: ConversationAgentRequest): string {
  const snapshot = input.snapshot!;
  const title = sanitizeInternalMessage(snapshot.sanitizedDomSnapshot.page.title);
  const labels = snapshot.sanitizedDomSnapshot.elements
    .filter((element) =>
      element.visible &&
      element.enabled &&
      element.securityPolicy !== "SECURE_INPUT" &&
      element.securityPolicy !== "BLOCKED",
    )
    .map((element) => element.ariaLabel ?? element.text ?? element.placeholder)
    .filter((value): value is string => Boolean(value?.trim()))
    .map(sanitizeInternalMessage)
    .filter((value) => value !== SAFE_INTERNAL_MESSAGE)
    .slice(0, 3);
  const options = labels.length > 0
    ? ` ${labels.join(", ")} 항목을 확인할 수 있습니다.`
    : "";
  return sanitizeInternalMessage(`현재 ${title} 화면입니다.${options}`);
}

function baseDecision(
  input: ConversationAgentRequest,
): Omit<AgentDecision, "mode" | "message" | "confidence" | "reasonCode">
  & Pick<AgentDecision, "mode" | "message" | "confidence" | "reasonCode"> {
  return {
    requestId: input.requestId,
    requestMessageId: input.requestMessageId,
    goalId: input.goal.goalId,
    baseGoalRevision: input.goal.revision,
    mode: "STOP",
    message: "요청을 안전하게 처리할 수 없습니다.",
    confidence: 1,
    reasonCode: "UNSUPPORTED_DAY1_INPUT",
    nextCondition: null,
    sourceSnapshotId: null,
    goalPatch: null,
    question: null,
    actionCandidate: null,
  };
}

function toDecision(
  input: ConversationAgentRequest,
  result: GoalPatchExtractionResult,
): AgentDecision {
  const base = baseDecision(input);
  if (result.kind === "SECURE_INPUT") {
    return { ...base, mode: "STOP", message: result.message, reasonCode: "SECURE_VALUE_REJECTED" };
  }
  if (result.kind === "CANCEL") {
    return { ...base, mode: "STOP", message: result.message, reasonCode: "USER_CANCELLED", goalPatch: result.patch };
  }
  if (result.kind === "CONFLICT") {
    return {
      ...base,
      mode: "STOP",
      message: result.message,
      reasonCode: "GOAL_VALUE_CONFLICT",
    };
  }
  if (result.kind === "AMBIGUOUS") {
    return {
      ...base,
      mode: "ASK_USER",
      message: result.message,
      reasonCode: "AMBIGUOUS_ANSWER",
      question: { fieldKey: result.fieldKey },
    };
  }

  if (result.patch.intent === "UNKNOWN") {
    if (input.snapshot !== null) {
      return describeAvailablePageActions(input);
    }
    return base;
  }

  const nextMissing = result.patch.missingFields?.[0];
  if (nextMissing) return askForMissing(base, result.patch, nextMissing);

  return {
    ...base,
    mode: "GOAL_PATCH_PROPOSED",
    message: null,
    reasonCode: "GOAL_UPDATED",
    nextCondition: "LATEST_DOM_DECISION",
    goalPatch: result.patch,
  };
}

function describeAvailablePageActions(
  input: ConversationAgentRequest,
): AgentDecision {
  const snapshot = input.snapshot!;
  const actionableRoles = new Set([
    "button", "link", "textbox", "checkbox", "radio", "combobox",
  ]);
  const labels = snapshot.sanitizedDomSnapshot.elements
    .filter((element) =>
      element.visible &&
      element.enabled &&
      element.securityPolicy === "NORMAL" &&
      actionableRoles.has(element.role?.toLowerCase() ?? "")
    )
    .map((element) =>
      element.ariaLabel ?? element.text ?? element.placeholder
    )
    .filter((value): value is string => Boolean(value?.trim()))
    .map(sanitizeDecisionLabel)
    .filter((label, index, all) => all.indexOf(label) === index)
    .slice(0, 4);
  const message = labels.length > 0
    ? `질문을 이해하지 못했습니다. 현재 화면에서는 ${labels.join(", ")} 항목을 이용할 수 있습니다. 원하는 작업을 다시 말씀해 주세요.`
    : "질문을 이해하지 못했습니다. 현재 화면에서 원하는 업무를 조금 더 구체적으로 말씀해 주세요.";

  return {
    ...baseDecision(input),
    mode: "INFORM_USER",
    message: sanitizeInternalMessage(message),
    reasonCode: "AVAILABLE_PAGE_ACTIONS",
    sourceSnapshotId: snapshot.sourceSnapshotId,
  };
}

function askForMissing(
  base: AgentDecision,
  patch: UserGoalPatch,
  fieldKey: string,
): AgentDecision {
  const message = fieldKey === "duration"
    ? "가입 기간은 얼마로 할까요?"
    : questionMessage(fieldKey);
  return {
    ...base,
    mode: "ASK_USER",
    message,
    confidence: 1,
    reasonCode: `MISSING_${fieldKey.toUpperCase()}`,
    goalPatch: patch,
    question: { fieldKey },
  };
}
