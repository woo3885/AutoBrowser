package com.ddd.backend.conversation.extension;

import com.ddd.backend.api.dto.extension.ExtensionAgentRequest;
import com.ddd.backend.api.dto.extension.ExtensionContinueRequest;
import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import com.ddd.backend.conversation.ConversationMessagePolicy;
import com.ddd.backend.conversation.agent.ConversationAgentContractValidator;
import com.ddd.backend.conversation.agent.ConversationAgentDecision;
import com.ddd.backend.conversation.agent.ConversationInteractionMode;
import com.ddd.backend.conversation.goal.UserGoalPatch;
import java.util.List;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNotNull;

class ExtensionAgentSessionServiceTest {

    @Test
    void appliesGoalPatchThenReturnsClientOwnedActionAndContinuesWithFreshDom() {
        AtomicInteger calls = new AtomicInteger();
        var policy = new ConversationMessagePolicy();
        var validator = new ConversationAgentContractValidator(policy);
        var service = new ExtensionAgentSessionService(request -> {
            int call = calls.incrementAndGet();
            if (call == 1) {
                return new ConversationAgentDecision(
                        request.requestId(), request.requestMessageId(), request.goal().goalId(),
                        request.goal().revision(), ConversationInteractionMode.GOAL_PATCH_PROPOSED,
                        null, 0.95, "GOAL", "LATEST_DOM_DECISION", null,
                        new UserGoalPatch(request.goal().revision(), "INQUIRY", null,
                                null, List.of(), null, null),
                        null, null);
            }
            if (call == 2) {
                return new ConversationAgentDecision(
                        request.requestId(), request.requestMessageId(), request.goal().goalId(),
                        request.goal().revision(), ConversationInteractionMode.AUTO_EXECUTE,
                        "검색 버튼을 누릅니다.", 0.92, "ACTION", null,
                        request.snapshot().sourceSnapshotId(), null, null,
                        new ConversationAgentDecision.ActionCandidate(
                                "CLICK", "el-one", "button", "검색", "검색 버튼", null));
            }
            return new ConversationAgentDecision(
                    request.requestId(), request.requestMessageId(), request.goal().goalId(),
                    request.goal().revision(), ConversationInteractionMode.INFORM_USER,
                    "검색 결과 페이지입니다.", 0.9, "DONE", null,
                    request.snapshot().sourceSnapshotId(), null, null, null);
        }, validator, policy);

        var first = service.create(new ExtensionAgentRequest(
                "request-1", "message-1", "검색해줘", "7:https://example.com", snapshot("snap-one")));

        assertEquals("AUTO_EXECUTE", first.mode());
        assertEquals("CLICK", first.action().actionType());
        assertEquals(1, first.goal().revision());
        assertNotNull(first.sessionId());

        var continued = service.continueAfterAction(first.sessionId(),
                new ExtensionContinueRequest("7:https://example.com/results", snapshot("snap-two")));

        assertEquals("INFORM_USER", continued.mode());
        assertEquals("snap-two", continued.sourceSnapshotId());
        assertEquals(3, calls.get());
    }

    private SanitizedDomSnapshot snapshot(String id) {
        return new SanitizedDomSnapshot("1.0", id,
                new SanitizedDomSnapshot.PageSnapshot("https://example.com", "Example"),
                List.of(new SanitizedDomSnapshot.ElementSnapshot(
                        "el-one", "button", "button", "검색", "검색", null,
                        null, true, true, null,
                        new SanitizedDomSnapshot.BoundingBoxSnapshot(1, 2, 30, 20),
                        SanitizedDomSnapshot.SecurityPolicy.NORMAL)));
    }
}
