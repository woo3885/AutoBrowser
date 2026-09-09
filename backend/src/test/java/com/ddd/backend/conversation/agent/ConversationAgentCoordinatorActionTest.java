package com.ddd.backend.conversation.agent;

import com.ddd.backend.automation.BrowserActionExecutionResult;
import com.ddd.backend.automation.BrowserActionType;
import com.ddd.backend.conversation.ConversationMessagePolicy;
import com.ddd.backend.conversation.ConversationService;
import com.ddd.backend.conversation.ConversationStateStore;
import com.ddd.backend.conversation.SessionMessageMailbox;
import com.ddd.backend.conversation.event.ConversationEventPublisher;
import com.ddd.backend.conversation.event.ConversationEventStore;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.infrastructure.session.InMemoryAutomationSessionRepository;
import com.ddd.backend.service.BrowserActionExecutionService;
import org.junit.jupiter.api.Test;
import org.springframework.messaging.simp.SimpMessagingTemplate;

import java.time.Duration;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class ConversationAgentCoordinatorActionTest {

    @Test
    void autoExecuteDelegatesOnlyTheValidatedElementAction() {
        var harness = harness();
        var actions = mock(BrowserActionExecutionService.class);
        when(actions.executeAiElementAction(
                harness.session().getSessionId(), BrowserActionType.CLICK, "el-deposit", null))
                .thenReturn(BrowserActionExecutionResult.executed(BrowserActionType.CLICK));
        harness.coordinator().setActionExecutionService(actions);

        var decision = decision(harness, ConversationInteractionMode.AUTO_EXECUTE,
                "예금 상품 화면으로 이동하고 있습니다.",
                new ConversationAgentDecision.ActionCandidate(
                        "CLICK", "el-deposit", "button", "예금 가입 시작",
                        "예금 상품 화면으로 이동하고 있습니다."));

        harness.coordinator().applyObservedDomDecision(
                harness.session().getSessionId(), decision, null);

        verify(actions).executeAiElementAction(
                harness.session().getSessionId(), BrowserActionType.CLICK, "el-deposit", null);
        assertThat(harness.session().getStatus()).isEqualTo(WorkflowStatus.AI_EXECUTING);
    }

    @Test
    void informUserAppendsTheAnalysisWithoutTerminatingTheSession() {
        var harness = harness();
        var decision = decision(harness, ConversationInteractionMode.INFORM_USER,
                "현재 화면에서는 예금과 이체 업무를 시작할 수 있습니다.", null);

        harness.coordinator().applyObservedDomDecision(
                harness.session().getSessionId(), decision, null);

        assertThat(harness.session().getStatus()).isEqualTo(WorkflowStatus.SESSION_CREATED);
        assertThat(harness.conversations().snapshot(harness.session().getSessionId())
                .recentSafeMessages()).extracting("content")
                .contains("현재 화면에서는 예금과 이체 업무를 시작할 수 있습니다.");
    }

    private Harness harness() {
        var sessions = new InMemoryAutomationSessionRepository();
        var session = sessions.save(AutomationSession.create("현재 사이트 분석해줘"));
        var states = new ConversationStateStore(Duration.ofMinutes(30));
        var mailbox = new SessionMessageMailbox();
        var events = new ConversationEventStore();
        var conversations = new ConversationService(
                sessions, states, mailbox, new ConversationMessagePolicy(), events);
        conversations.acceptInitial(session.getSessionId(),
                "request-1", "message-1", "현재 사이트 분석해줘", null);
        var publisher = new ConversationEventPublisher(
                events, mock(SimpMessagingTemplate.class));
        var coordinator = new ConversationAgentCoordinator(
                conversations, mailbox, sessions, request -> null,
                new ConversationAgentContractValidator(new ConversationMessagePolicy()), publisher);
        return new Harness(session, conversations, coordinator);
    }

    private ConversationAgentDecision decision(
            Harness harness,
            ConversationInteractionMode mode,
            String message,
            ConversationAgentDecision.ActionCandidate actionCandidate
    ) {
        var goal = harness.conversations().state(harness.session().getSessionId()).goal();
        return new ConversationAgentDecision(
                "request-1", "message-1", goal.goalId(), goal.revision(),
                mode, message, 1.0, "TEST", null,
                "snapshot-1", null, null, actionCandidate);
    }

    private record Harness(
            AutomationSession session,
            ConversationService conversations,
            ConversationAgentCoordinator coordinator
    ) { }
}
