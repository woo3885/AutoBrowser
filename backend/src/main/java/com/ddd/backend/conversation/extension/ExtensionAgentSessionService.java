package com.ddd.backend.conversation.extension;

import com.ddd.backend.api.dto.extension.ExtensionAgentRequest;
import com.ddd.backend.api.dto.extension.ExtensionAgentResponse;
import com.ddd.backend.api.dto.extension.ExtensionContinueRequest;
import com.ddd.backend.conversation.ConversationMessagePolicy;
import com.ddd.backend.conversation.agent.ConversationAgentClient;
import com.ddd.backend.conversation.agent.ConversationAgentContractValidator;
import com.ddd.backend.conversation.agent.ConversationAgentDecision;
import com.ddd.backend.conversation.agent.ConversationAgentRequest;
import com.ddd.backend.conversation.agent.ConversationInteractionMode;
import com.ddd.backend.conversation.goal.UserGoal;
import com.ddd.backend.conversation.goal.UserGoalAuthority;
import java.time.Duration;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

/**
 * Coordinates AI decisions for a user-owned Chrome tab. Unlike an automation
 * session this service never creates Playwright or executes an action on the
 * server. The extension owns both the DOM snapshot and action execution.
 */
@Service
public final class ExtensionAgentSessionService {
    private static final Duration SESSION_TTL = Duration.ofMinutes(30);
    private static final int MAX_GOAL_PATCHES_PER_REQUEST = 2;

    private final Map<String, ExtensionSession> sessions = new ConcurrentHashMap<>();
    private final ConversationAgentClient client;
    private final ConversationAgentContractValidator validator;
    private final ConversationMessagePolicy messagePolicy;

    public ExtensionAgentSessionService(
            ConversationAgentClient client,
            ConversationAgentContractValidator validator,
            ConversationMessagePolicy messagePolicy
    ) {
        this.client = client;
        this.validator = validator;
        this.messagePolicy = messagePolicy;
    }

    public ExtensionAgentResponse create(ExtensionAgentRequest request) {
        Instant now = Instant.now();
        sessions.entrySet().removeIf(entry -> entry.getValue().expiresAt.isBefore(now));
        String sessionId = UUID.randomUUID().toString();
        ExtensionSession session = new ExtensionSession(sessionId);
        sessions.put(sessionId, session);
        try {
            return processMessage(session, request);
        } catch (RuntimeException exception) {
            sessions.remove(sessionId);
            throw exception;
        }
    }

    public ExtensionAgentResponse message(String sessionId, ExtensionAgentRequest request) {
        return processMessage(requireSession(sessionId), request);
    }

    public ExtensionAgentResponse continueAfterAction(
            String sessionId,
            ExtensionContinueRequest request
    ) {
        ExtensionSession session = requireSession(sessionId);
        synchronized (session) {
            session.touch();
            if (session.requestId == null || session.messageId == null) {
                throw new IllegalStateException("Extension session has no active request");
            }
            return decide(session, "AUTO_ACTION_COMPLETED", request.pageIdentity(),
                    request.snapshot(), null);
        }
    }

    private ExtensionAgentResponse processMessage(
            ExtensionSession session,
            ExtensionAgentRequest request
    ) {
        synchronized (session) {
            session.touch();
            String content = messagePolicy.sanitize(request.content());
            session.requestId = request.requestId().trim();
            session.messageId = request.messageId().trim();
            session.sequence++;
            session.goal.initializeRequest(content);
            String answerToQuestionId = session.questionId;
            return decide(session, content, request.pageIdentity(), request.snapshot(),
                    answerToQuestionId);
        }
    }

    private ExtensionAgentResponse decide(
            ExtensionSession session,
            String content,
            String pageIdentity,
            com.ddd.backend.automation.dom.SanitizedDomSnapshot snapshot,
            String answerToQuestionId
    ) {
        ConversationAgentDecision decision = null;
        for (int attempt = 0; attempt <= MAX_GOAL_PATCHES_PER_REQUEST; attempt++) {
            UserGoal goal = session.goal.snapshot();
            ConversationAgentRequest aiRequest = new ConversationAgentRequest(
                    session.sessionId,
                    session.requestId,
                    session.messageId,
                    session.sequence,
                    goal,
                    new ConversationAgentRequest.UserMessage(content, answerToQuestionId),
                    new ConversationAgentRequest.SnapshotContext(
                            snapshot.snapshotId(), pageIdentity, snapshot));
            decision = validator.validate(aiRequest, client.decide(aiRequest));
            if (decision.mode() != ConversationInteractionMode.GOAL_PATCH_PROPOSED) {
                break;
            }
            session.goal.apply(decision.goalId(), decision.baseGoalRevision(),
                    session.nextMutationId(), decision.goalPatch(), null);
            session.questionId = null;
            answerToQuestionId = null;
        }
        if (decision == null || decision.mode() == ConversationInteractionMode.GOAL_PATCH_PROPOSED) {
            throw new IllegalStateException("Extension AI exceeded the goal update limit");
        }

        String questionId = null;
        if (decision.mode() == ConversationInteractionMode.ASK_USER) {
            questionId = UUID.randomUUID().toString();
            UserGoal.PendingQuestion pending = new UserGoal.PendingQuestion(
                    questionId, decision.question().fieldKey());
            session.goal.apply(decision.goalId(), decision.baseGoalRevision(),
                    session.nextMutationId(), decision.goalPatch(), pending);
            session.questionId = questionId;
        } else if (session.questionId != null
                && decision.mode() != ConversationInteractionMode.AUTO_EXECUTE) {
            session.questionId = null;
        }

        return new ExtensionAgentResponse(
                session.sessionId,
                decision.mode().name(),
                decision.message(),
                questionId,
                session.sequence,
                session.goal.snapshot(),
                decision.sourceSnapshotId(),
                decision.actionCandidate());
    }

    private ExtensionSession requireSession(String sessionId) {
        ExtensionSession session = sessions.get(sessionId);
        if (session == null || session.expiresAt.isBefore(Instant.now())) {
            sessions.remove(sessionId);
            throw new IllegalArgumentException("Extension session not found or expired");
        }
        return session;
    }

    private static final class ExtensionSession {
        private final String sessionId;
        private final UserGoalAuthority goal = new UserGoalAuthority();
        private long sequence;
        private String requestId;
        private String messageId;
        private String questionId;
        private long mutationSequence;
        private Instant expiresAt;

        private ExtensionSession(String sessionId) {
            this.sessionId = sessionId;
            touch();
        }

        private void touch() {
            expiresAt = Instant.now().plus(SESSION_TTL);
        }

        private String nextMutationId() {
            return messageId + ":mutation-" + (++mutationSequence);
        }
    }
}
