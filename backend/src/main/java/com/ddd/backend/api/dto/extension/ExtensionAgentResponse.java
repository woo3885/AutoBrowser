package com.ddd.backend.api.dto.extension;

import com.ddd.backend.conversation.agent.ConversationAgentDecision;
import com.ddd.backend.conversation.goal.UserGoal;

public record ExtensionAgentResponse(
        String sessionId,
        String mode,
        String message,
        String questionId,
        long conversationSequence,
        UserGoal goal,
        String sourceSnapshotId,
        ConversationAgentDecision.ActionCandidate action
) { }
