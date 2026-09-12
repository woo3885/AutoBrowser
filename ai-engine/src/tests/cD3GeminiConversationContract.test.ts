import assert from "node:assert/strict";
import test from "node:test";

import type { AgentDecision, ConversationAgentRequest } from "../conversation/conversationAgent.types.js";
import {
  GeminiConversationContractError,
  GeminiConversationModel,
  SafetyBoundConversationModel,
  type GeminiConversationTransport,
} from "../conversation/geminiConversation.model.js";
import { ScriptedConversationModel } from "../conversation/scriptedConversation.model.js";
import { C_D2_DEPOSIT_FIXTURES } from "./fixtures/cD2Deposit.fixtures.js";

function request(id: string): ConversationAgentRequest {
  const fixture = C_D2_DEPOSIT_FIXTURES.find((candidate) => candidate.id === id);
  if (!fixture) throw new Error(`Missing Day2 fixture ${id}`);
  return structuredClone(fixture.request);
}

async function scriptedDecision(id: string): Promise<{ request: ConversationAgentRequest; decision: AgentDecision }> {
  const input = request(id);
  return { request: input, decision: await new ScriptedConversationModel().decide(input) };
}

function adapter(output: unknown, observedPrompts: string[] = []): GeminiConversationModel {
  const transport: GeminiConversationTransport = async ({ prompt }) => {
    observedPrompts.push(prompt);
    return typeof output === "string" ? output : JSON.stringify(output);
  };
  return new GeminiConversationModel(transport);
}

async function rejectsContract(
  input: ConversationAgentRequest,
  output: unknown,
  code: GeminiConversationContractError["code"] = "INVALID_DECISION",
): Promise<void> {
  await assert.rejects(
    adapter(output).decide(input),
    (error: unknown) => error instanceof GeminiConversationContractError && error.code === code,
  );
}

test("C-D3-GEMINI-01 accepts a valid ConversationAgentRequest -> AgentDecision result without a key", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  const prompts: string[] = [];
  const actual = await adapter(decision, prompts).decide(input);
  assert.deepEqual(actual, decision);
  assert.match(prompts[0] ?? "", /BEGIN_UNTRUSTED_DATA_JSON/u);
});

test("C-D3-GEMINI-02 rejects an unknown mode", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, { ...decision, mode: "ROOT_OVERRIDE" });
});

test("C-D3-GEMINI-03 rejects an invalid action candidate shape", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, {
    ...decision,
    actionCandidate: { ...decision.actionCandidate!, selector: "#password" },
  });
});

test("C-D3-GEMINI-04 rejects secure-screen AUTO_EXECUTE", async () => {
  const { request: input, decision } = await scriptedDecision("08");
  await rejectsContract(input, {
    ...decision,
    mode: "AUTO_EXECUTE",
    message: "다음 단계를 진행합니다.",
    reasonCode: "MODEL_AUTO",
    actionCandidate: {
      actionType: "TYPE",
      targetElementId: "el-password",
      role: "textbox",
      accessibleLabel: "계좌 비밀번호",
      guide: "다음 단계를 진행합니다.",
    },
  });
});

test("C-D3-GEMINI-05 rejects final-confirmation CLICK", async () => {
  const { request: input, decision } = await scriptedDecision("10");
  await rejectsContract(input, {
    ...decision,
    mode: "AUTO_EXECUTE",
    message: "다음 단계를 진행합니다.",
    reasonCode: "MODEL_AUTO",
    actionCandidate: {
      actionType: "CLICK",
      targetElementId: "el-final-approve",
      role: "button",
      accessibleLabel: "Demo 예금 최종 승인",
      guide: "다음 단계를 진행합니다.",
    },
  });
});

test("C-D3-GEMINI-06 rejects a stale sourceSnapshotId", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, { ...decision, sourceSnapshotId: "snap-old" });
});

test("C-D3-GEMINI-07 rejects raw credential echo", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, { ...decision, message: "OTP 123456" });
});

test("C-D3-GEMINI-08 rejects invalid JSON", async () => {
  await rejectsContract(request("03"), "```json not-json ```", "INVALID_JSON");
});

test("C-GUIDE-GEMINI-09 rejects GUIDE_USER without an internal target reference", async () => {
  const { request: input, decision } = await scriptedDecision("04");
  await rejectsContract(input, {
    ...decision,
    actionCandidate: { actionType: "WAIT_FOR_USER" },
  });
});

test("C-GUIDE-GEMINI-10 rejects GUIDE_USER with a raw selector", async () => {
  const { request: input, decision } = await scriptedDecision("04");
  await rejectsContract(input, {
    ...decision,
    actionCandidate: { ...decision.actionCandidate!, XPath: "//button" },
  });
});

test("C-GUIDE-GEMINI-11 rejects GUIDE_USER on a secure target", async () => {
  const { request: input, decision } = await scriptedDecision("08");
  await rejectsContract(input, {
    ...decision,
    mode: "GUIDE_USER",
    message: "필요한 항목을 직접 선택해 주세요.",
    reasonCode: "MODEL_GUIDE",
    actionCandidate: {
      actionType: "WAIT_FOR_USER",
      targetElementId: "el-password",
      role: "textbox",
      accessibleLabel: "계좌 비밀번호",
      guide: "필요한 항목을 직접 선택해 주세요.",
    },
  });
});

test("C-GUIDE-GEMINI-12 rejects GUIDE_USER while risk policy is active", async () => {
  const { request: input, decision } = await scriptedDecision("09");
  const target = input.snapshot!.sanitizedDomSnapshot.elements[0]!;
  target.role = "button";
  target.enabled = true;
  target.securityPolicy = "USER_DECISION";
  await rejectsContract(input, {
    ...decision,
    mode: "GUIDE_USER",
    message: "필요한 항목을 직접 선택해 주세요.",
    reasonCode: "MODEL_GUIDE",
    actionCandidate: {
      actionType: "WAIT_FOR_USER",
      targetElementId: target.elementId,
      role: "button",
      accessibleLabel: "보이스피싱 의심 거래 안내",
      guide: "필요한 항목을 직접 선택해 주세요.",
    },
  });
});

test("C-GUIDE-GEMINI-13 rejects GUIDE_USER on a final target", async () => {
  const { request: input, decision } = await scriptedDecision("10");
  await rejectsContract(input, {
    ...decision,
    mode: "GUIDE_USER",
    message: "필요한 항목을 직접 선택해 주세요.",
    reasonCode: "MODEL_GUIDE",
    actionCandidate: {
      actionType: "WAIT_FOR_USER",
      targetElementId: "el-final-approve",
      role: "button",
      accessibleLabel: "Demo 예금 최종 승인",
      guide: "필요한 항목을 직접 선택해 주세요.",
    },
  });
});

test("C-GUIDE-GEMINI-14 rejects AUTO_EXECUTE without sourceSnapshotId", async () => {
  const { request: input, decision } = await scriptedDecision("03");
  await rejectsContract(input, { ...decision, sourceSnapshotId: null });
});

test("C-GUIDE-GEMINI-15 rejects nonexistent and duplicate internal references", async () => {
  const { request: input, decision } = await scriptedDecision("04");
  await rejectsContract(input, {
    ...decision,
    actionCandidate: { ...decision.actionCandidate!, targetElementId: "el-missing" },
  });

  const duplicateInput = structuredClone(input);
  duplicateInput.snapshot!.sanitizedDomSnapshot.elements.push({
    ...duplicateInput.snapshot!.sanitizedDomSnapshot.elements[0]!,
  });
  await rejectsContract(duplicateInput, decision);
});

test("site-agnostic planner may choose a safe action on an unrelated website", async () => {
  const input = request("03");
  input.goal.intent = "UNKNOWN";
  input.goal.normalizedRequest = "검색창에서 서울 날씨를 검색해줘";
  input.snapshot!.sanitizedDomSnapshot.page.url = "https://search.example.com/";
  input.snapshot!.sanitizedDomSnapshot.page.title = "Example Search";
  input.snapshot!.sanitizedDomSnapshot.elements = [{
    elementId: "el-search-box",
    tag: "input",
    role: "textbox",
    text: null,
    ariaLabel: "검색",
    placeholder: "검색어 입력",
    inputType: "search",
    visible: true,
    enabled: true,
    checked: null,
    boundingBox: { x: 10, y: 10, width: 300, height: 40 },
    securityPolicy: "NORMAL",
  }];
  const message = "검색창에 서울 날씨를 입력합니다.";
  const decision: AgentDecision = {
    requestId: input.requestId,
    requestMessageId: input.requestMessageId,
    goalId: input.goal.goalId,
    baseGoalRevision: input.goal.revision,
    mode: "AUTO_EXECUTE",
    message,
    confidence: 0.95,
    reasonCode: "MODEL_SAFE_ACTION",
    nextCondition: null,
    sourceSnapshotId: input.snapshot!.sourceSnapshotId,
    goalPatch: null,
    question: null,
    actionCandidate: {
      actionType: "TYPE",
      targetElementId: "el-search-box",
      role: "textbox",
      accessibleLabel: "검색",
      guide: message,
      inputValue: "서울 날씨",
    },
  };

  assert.deepEqual(await adapter(decision).decide(input), decision);
});

test("deterministic security boundary runs before the site-agnostic model", async () => {
  let modelCalls = 0;
  const model = new SafetyBoundConversationModel(new GeminiConversationModel(async () => {
    modelCalls += 1;
    return "{}";
  }));

  const decision = await model.decide(request("08"));

  assert.equal(decision.mode, "SECURE_INPUT_REQUIRED");
  assert.equal(modelCalls, 0);
});
