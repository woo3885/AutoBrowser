import assert from "node:assert/strict";
import test from "node:test";

import {
  decideConversationInteraction,
  validateConversationInteractionDecision,
} from "../conversation/conversationInteraction.policy.js";
import {
  PageAwareConversationModel,
  ScriptedConversationModel,
} from "../conversation/scriptedConversation.model.js";
import {
  C_D2_DEPOSIT_FIXTURES,
  conversationElement,
  conversationRequest,
  conversationSnapshot,
} from "./fixtures/cD2Deposit.fixtures.js";

test("C-D2-04 all deterministic workflow interaction modes remain semantically distinct", async () => {
  const decisions = await Promise.all(
    C_D2_DEPOSIT_FIXTURES.map((fixture) =>
      new ScriptedConversationModel().decide(fixture.request)),
  );
  const completed = conversationRequest(conversationSnapshot(
    "snap-completed",
    [conversationElement("el-home", "메인으로 돌아가기")],
    "https://demo.test/deposit/completed/deposit-12m",
  ));
  decisions.push(decideConversationInteraction(completed));

  assert.deepEqual(new Set(decisions.map((decision) => decision.mode)), new Set([
    "AUTO_EXECUTE",
    "GUIDE_USER",
    "ASK_USER",
    "GOAL_PATCH_PROPOSED",
    "SECURE_INPUT_REQUIRED",
    "RISK_WARNING",
    "FINAL_CONFIRMATION_REQUIRED",
    "COMPLETE",
    "STOP",
  ]));
});

test("C-D2-04 protected and stale targets cannot become AUTO_EXECUTE", () => {
  const protectedRequest = conversationRequest(conversationSnapshot("snap-protected", [
    conversationElement("el-product", "정기예금 상품", {
      securityPolicy: "USER_DECISION",
    }),
  ]));
  const unsafe = {
    ...decideConversationInteraction(protectedRequest),
    mode: "AUTO_EXECUTE" as const,
    message: "다음 화면으로 이동합니다.",
    actionCandidate: {
      actionType: "CLICK" as const,
      targetElementId: "el-product",
      role: "button",
      accessibleLabel: "정기예금 상품",
      guide: "다음 화면으로 이동합니다.",
    },
  };
  const result = validateConversationInteractionDecision(protectedRequest, unsafe);
  assert.equal(result.valid, false);
  assert.match(result.errors.join(" "), /expected GUIDE_USER|current snapshot policy/u);

  const stale = C_D2_DEPOSIT_FIXTURES.find((fixture) => fixture.id === "11")!;
  const staleDecision = decideConversationInteraction(stale.request);
  assert.equal(staleDecision.mode, "STOP");
  assert.equal(staleDecision.actionCandidate, null);
});

test("C-D2-04 semantic validator rejects Backend authority and unsafe messages", () => {
  const request = C_D2_DEPOSIT_FIXTURES.find((fixture) => fixture.id === "03")!.request;
  const safe = decideConversationInteraction(request);
  for (const invalid of [
    { ...safe, goalId: "model-created-goal" },
    { ...safe, baseGoalRevision: safe.baseGoalRevision + 1 },
    { ...safe, sourceSnapshotId: "stale-snapshot" },
    { ...safe, message: "<b>elementId와 selector를 사용합니다.</b>" },
  ]) {
    assert.equal(validateConversationInteractionDecision(request, invalid).valid, false);
  }
});

test("C-D2-04 unknown mode fails closed at the strict schema", () => {
  const request = C_D2_DEPOSIT_FIXTURES.find((fixture) => fixture.id === "03")!.request;
  const decision = {
    ...decideConversationInteraction(request),
    mode: "MODEL_INVENTED_MODE",
  };
  assert.equal(validateConversationInteractionDecision(request, decision).valid, false);
});

test("C-D2-04 Backend-resolved confirmation cannot be proposed again", () => {
  const fixture = C_D2_DEPOSIT_FIXTURES.find((item) => item.id === "10")!;
  const request = structuredClone(fixture.request);
  request.goal.safety.confirmationState = "APPROVED";

  const decision = decideConversationInteraction(request);
  assert.equal(decision.mode, "STOP");
  assert.equal(decision.reasonCode, "BLOCKED_TARGET");
  assert.equal(decision.actionCandidate, null);
});

test("C-D2-04 deposit inquiry automatically opens the unique safe home entry", async () => {
  const snapshot = conversationSnapshot(
    "snap-home",
    [
      conversationElement("el-deposit", "예금 가입 시작"),
      conversationElement("el-transfer", "계좌이체 시작"),
    ],
    "https://demo.test/",
  );
  const request = conversationRequest(snapshot);
  request.goal = {
    ...request.goal,
    intent: "INQUIRY",
    normalizedRequest: "예금 상품 알아보기",
    amount: null,
    duration: null,
  };

  const decision = await new ScriptedConversationModel().decide(request);

  assert.equal(decision.mode, "AUTO_EXECUTE");
  assert.equal(decision.reasonCode, "DEPOSIT_HOME_ENTRY");
  assert.equal(decision.actionCandidate?.actionType, "CLICK");
  assert.equal(decision.actionCandidate?.targetElementId, "el-deposit");
  assert.equal(decision.actionCandidate?.accessibleLabel, "예금 가입 시작");
});

test("current page analysis returns a non-terminal AI message from the sanitized snapshot", async () => {
  const request = conversationRequest(conversationSnapshot(
    "snap-analysis",
    [conversationElement("el-deposit", "예금 가입 시작")],
    "https://demo.test/",
  ));
  request.userMessage.content = "현재 사이트 분석해줘";
  request.goal = { ...request.goal, intent: "INQUIRY", missingFields: [] };
  const prompts: string[] = [];
  const model = new PageAwareConversationModel(
    new ScriptedConversationModel(),
    async ({ prompt }) => {
      prompts.push(prompt);
      return "현재 데모뱅크 홈 화면이며 예금 가입 업무를 시작할 수 있습니다.";
    },
  );

  const decision = await model.decide(request);

  assert.equal(decision.mode, "INFORM_USER");
  assert.equal(decision.reasonCode, "CURRENT_PAGE_ANALYSIS");
  assert.equal(decision.sourceSnapshotId, "snap-analysis");
  assert.equal(decision.actionCandidate, null);
  assert.match(decision.message ?? "", /데모뱅크 홈 화면/u);
  assert.doesNotMatch(prompts[0] ?? "", /el-deposit/u);
  assert.equal(validateConversationInteractionDecision(request, decision).valid, true);
});

test("current page analysis falls back safely when the language model is unavailable", async () => {
  const request = conversationRequest(conversationSnapshot(
    "snap-analysis-fallback",
    [conversationElement("el-deposit", "예금 가입 시작")],
    "https://demo.test/",
  ));
  request.userMessage.content = "현재 화면 분석해줘";
  request.goal = { ...request.goal, intent: "INQUIRY", missingFields: [] };
  const model = new PageAwareConversationModel(
    new ScriptedConversationModel(),
    async () => { throw new Error("offline"); },
  );

  const decision = await model.decide(request);

  assert.equal(decision.mode, "INFORM_USER");
  assert.match(decision.message ?? "", /현재/u);
  assert.equal(validateConversationInteractionDecision(request, decision).valid, true);
});
