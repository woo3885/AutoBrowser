package com.ddd.backend.api.controller;

import com.ddd.backend.config.RestCorsProperties;
import com.ddd.backend.conversation.extension.ExtensionAgentSessionService;
import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.boot.webmvc.test.autoconfigure.WebMvcTest;
import org.springframework.test.context.bean.override.mockito.MockitoBean;
import org.springframework.test.web.servlet.MockMvc;
import org.springframework.beans.factory.annotation.Autowired;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.options;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.header;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(ExtensionAgentController.class)
@EnableConfigurationProperties(RestCorsProperties.class)
class ExtensionAgentControllerTest {
    @Autowired MockMvc mockMvc;
    @MockitoBean ExtensionAgentSessionService sessions;

    @Test
    void extensionEndpointAllowsChromeExtensionPreflight() throws Exception {
        mockMvc.perform(options("/api/v1/extension/sessions")
                        .header("Origin", "chrome-extension://abcdefghijklmnopabcdefghijklmnop")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Content-Type"))
                .andExpect(status().isOk())
                .andExpect(header().string("Access-Control-Allow-Origin",
                        "chrome-extension://abcdefghijklmnopabcdefghijklmnop"));
    }

    @Test
    void extensionEndpointDoesNotAllowUnconfiguredWebsiteOrigin() throws Exception {
        mockMvc.perform(options("/api/v1/extension/sessions")
                        .header("Origin", "https://untrusted.example")
                        .header("Access-Control-Request-Method", "POST")
                        .header("Access-Control-Request-Headers", "Content-Type"))
                .andExpect(status().isForbidden());
    }
}
