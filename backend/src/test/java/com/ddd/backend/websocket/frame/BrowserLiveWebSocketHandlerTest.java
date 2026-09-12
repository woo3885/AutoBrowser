package com.ddd.backend.websocket.frame;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.domain.session.AutomationSession;
import com.ddd.backend.security.secureinput.SecureInputRegistry;
import com.ddd.backend.service.AutomationSessionService;
import com.google.gson.JsonParser;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.web.socket.WebSocketSession;

import java.util.Map;

import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

class BrowserLiveWebSocketHandlerTest {

    private BrowserSessionManager browserSessions;
    private AutomationSessionService automationSessions;
    private SecureInputRegistry secureInputs;
    private BrowserLiveWebSocketHandler handler;
    private WebSocketSession socket;

    @BeforeEach
    void setUp() {
        browserSessions = mock(BrowserSessionManager.class);
        automationSessions = mock(AutomationSessionService.class);
        secureInputs = mock(SecureInputRegistry.class);
        handler = new BrowserLiveWebSocketHandler(
                browserSessions, automationSessions, secureInputs);
        socket = mock(WebSocketSession.class);
        when(socket.getAttributes()).thenReturn(Map.of(
                FrameWebSocketHandshakeInterceptor.SESSION_ID_ATTRIBUTE, "session-live"));
        when(socket.isOpen()).thenReturn(true);
        when(automationSessions.getSession("session-live"))
                .thenReturn(AutomationSession.create("live viewer"));
    }

    @AfterEach
    void tearDown() {
        handler.close();
    }

    @Test
    void dispatchesViewerClickOverTheDuplexSocket() {
        handler.dispatchInput("session-live", socket, JsonParser.parseString(
                "{\"type\":\"CLICK\",\"x\":640,\"y\":360}").getAsJsonObject());

        verify(browserSessions).dispatchLiveClick("session-live", 640, 360);
    }

    @Test
    void rejectsCoordinatesOutsideTheBrowserViewport() {
        handler.dispatchInput("session-live", socket, JsonParser.parseString(
                "{\"type\":\"CLICK\",\"x\":1280,\"y\":360}").getAsJsonObject());

        verify(browserSessions, never())
                .dispatchLiveClick("session-live", 1280, 360);
    }
}
