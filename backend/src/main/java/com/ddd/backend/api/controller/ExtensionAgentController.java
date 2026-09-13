package com.ddd.backend.api.controller;

import com.ddd.backend.api.dto.extension.ExtensionAgentRequest;
import com.ddd.backend.api.dto.extension.ExtensionAgentResponse;
import com.ddd.backend.api.dto.extension.ExtensionContinueRequest;
import com.ddd.backend.common.response.ApiResponse;
import com.ddd.backend.conversation.extension.ExtensionAgentSessionService;
import jakarta.validation.Valid;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api/v1/extension/sessions")
public final class ExtensionAgentController {
    private final ExtensionAgentSessionService sessions;

    public ExtensionAgentController(ExtensionAgentSessionService sessions) {
        this.sessions = sessions;
    }

    @PostMapping
    public ResponseEntity<ApiResponse<ExtensionAgentResponse>> create(
            @Valid @RequestBody ExtensionAgentRequest request
    ) {
        return ResponseEntity.status(HttpStatus.CREATED)
                .body(ApiResponse.success(sessions.create(request)));
    }

    @PostMapping("/{sessionId}/messages")
    public ApiResponse<ExtensionAgentResponse> message(
            @PathVariable String sessionId,
            @Valid @RequestBody ExtensionAgentRequest request
    ) {
        return ApiResponse.success(sessions.message(sessionId, request));
    }

    @PostMapping("/{sessionId}/continue")
    public ApiResponse<ExtensionAgentResponse> continueAfterAction(
            @PathVariable String sessionId,
            @Valid @RequestBody ExtensionContinueRequest request
    ) {
        return ApiResponse.success(sessions.continueAfterAction(sessionId, request));
    }
}
