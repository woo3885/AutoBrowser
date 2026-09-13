package com.ddd.backend.api.dto.extension;

import com.ddd.backend.automation.dom.SanitizedDomSnapshot;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

public record ExtensionAgentRequest(
        @NotBlank @Size(max = 128) String requestId,
        @NotBlank @Size(max = 128) String messageId,
        @NotBlank @Size(max = 500) String content,
        @NotBlank @Size(max = 512) String pageIdentity,
        @Valid @NotNull SanitizedDomSnapshot snapshot
) { }
