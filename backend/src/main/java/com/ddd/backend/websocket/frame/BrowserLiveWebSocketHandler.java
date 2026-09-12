package com.ddd.backend.websocket.frame;

import com.ddd.backend.automation.session.BrowserSessionManager;
import com.ddd.backend.domain.session.WorkflowStatus;
import com.ddd.backend.security.secureinput.SecureInputRegistry;
import com.ddd.backend.service.AutomationSessionService;
import com.google.gson.JsonObject;
import com.google.gson.JsonParser;
import jakarta.annotation.PreDestroy;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Component;
import org.springframework.web.socket.BinaryMessage;
import org.springframework.web.socket.CloseStatus;
import org.springframework.web.socket.SubProtocolCapable;
import org.springframework.web.socket.TextMessage;
import org.springframework.web.socket.WebSocketSession;
import org.springframework.web.socket.handler.AbstractWebSocketHandler;

import java.io.IOException;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import java.util.concurrent.ScheduledExecutorService;
import java.util.concurrent.ScheduledFuture;
import java.util.concurrent.TimeUnit;

@Component
public final class BrowserLiveWebSocketHandler extends AbstractWebSocketHandler
        implements SubProtocolCapable {

    public static final String SUB_PROTOCOL = "ddd.browser-live.v2";
    private static final Logger log = LoggerFactory.getLogger(BrowserLiveWebSocketHandler.class);
    private static final Set<WorkflowStatus> INPUT_BLOCKED = Set.of(
            WorkflowStatus.SECURE_INPUT_REQUIRED,
            WorkflowStatus.FINAL_CONFIRMATION_REQUIRED,
            WorkflowStatus.RISK_WARNING,
            WorkflowStatus.COMPLETED,
            WorkflowStatus.CANCELLED,
            WorkflowStatus.ERROR,
            WorkflowStatus.TERMINATED);

    private final BrowserSessionManager browserSessions;
    private final AutomationSessionService automationSessions;
    private final SecureInputRegistry secureInputs;
    private final Map<String, WebSocketSession> connections = new ConcurrentHashMap<>();
    private final Map<String, ScheduledFuture<?>> pumps = new ConcurrentHashMap<>();
    private final ExecutorService commands = Executors.newSingleThreadExecutor(
            Thread.ofVirtual().name("browser-live-command").factory());
    private final ScheduledExecutorService scheduler = Executors.newSingleThreadScheduledExecutor(
            Thread.ofPlatform().daemon().name("browser-live-pump").factory());
    private final Set<String> pumping = ConcurrentHashMap.newKeySet();

    public BrowserLiveWebSocketHandler(
            BrowserSessionManager browserSessions,
            AutomationSessionService automationSessions,
            SecureInputRegistry secureInputs
    ) {
        this.browserSessions = browserSessions;
        this.automationSessions = automationSessions;
        this.secureInputs = secureInputs;
    }

    @Override
    public List<String> getSubProtocols() {
        return List.of(SUB_PROTOCOL);
    }

    @Override
    public void afterConnectionEstablished(WebSocketSession socket) throws Exception {
        if (!SUB_PROTOCOL.equals(socket.getAcceptedProtocol())) {
            socket.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        String sessionId = sessionId(socket);
        if (sessionId == null || connections.putIfAbsent(sessionId, socket) != null) {
            socket.close(CloseStatus.POLICY_VIOLATION);
            return;
        }
        commands.submit(() -> {
            try {
                browserSessions.startLiveStream(sessionId, frame -> sendFrame(socket, frame));
                ScheduledFuture<?> pump = scheduler.scheduleWithFixedDelay(
                        () -> {
                            if (!pumping.add(sessionId)) return;
                            commands.submit(() -> {
                                try { pump(sessionId, socket); }
                                finally { pumping.remove(sessionId); }
                            });
                        },
                        0, 40, TimeUnit.MILLISECONDS);
                ScheduledFuture<?> previous = pumps.put(sessionId, pump);
                if (previous != null) previous.cancel(false);
            } catch (RuntimeException exception) {
                log.warn("Could not start live browser stream. sessionId={}", sessionId);
                closeQuietly(socket, CloseStatus.SERVER_ERROR);
            }
        });
    }

    @Override
    protected void handleTextMessage(WebSocketSession socket, TextMessage message) {
        String sessionId = sessionId(socket);
        if (sessionId == null || message.getPayloadLength() > 4_096) {
            closeQuietly(socket, CloseStatus.POLICY_VIOLATION);
            return;
        }
        final JsonObject input;
        try {
            input = JsonParser.parseString(message.getPayload()).getAsJsonObject();
        } catch (RuntimeException exception) {
            sendStatus(socket, "INPUT_REJECTED", "입력 형식이 올바르지 않습니다.");
            return;
        }
        commands.submit(() -> dispatchInput(sessionId, socket, input));
    }

    void dispatchInput(String sessionId, WebSocketSession socket, JsonObject input) {
        try {
            ensureInputAllowed(sessionId);
            String type = requiredString(input, "type", 32);
            switch (type) {
                case "CLICK" -> browserSessions.dispatchLiveClick(
                        sessionId, coordinate(input, "x", 1279), coordinate(input, "y", 719));
                case "WHEEL" -> browserSessions.dispatchLiveWheel(
                        sessionId,
                        coordinate(input, "x", 1279), coordinate(input, "y", 719),
                        delta(input, "deltaX"), delta(input, "deltaY"));
                case "KEY" -> browserSessions.dispatchLiveKey(
                        sessionId, requiredString(input, "key", 32));
                case "TEXT" -> browserSessions.dispatchLiveText(
                        sessionId, requiredString(input, "text", 500));
                default -> throw new IllegalArgumentException("Unsupported live input");
            }
            sendStatus(socket, "INPUT_ACCEPTED", type);
        } catch (RuntimeException exception) {
            sendStatus(socket, "INPUT_REJECTED", "현재 화면에서 해당 입력을 처리할 수 없습니다.");
        }
    }

    private void ensureInputAllowed(String sessionId) {
        if (secureInputs.isActive(sessionId)
                || INPUT_BLOCKED.contains(automationSessions.getSession(sessionId).getStatus())) {
            throw new IllegalStateException("Live input is blocked by session safety state");
        }
    }

    private void pump(String sessionId, WebSocketSession socket) {
        if (!socket.isOpen() || connections.get(sessionId) != socket) return;
        try {
            if (!browserSessions.exists(sessionId)) {
                closeQuietly(socket, CloseStatus.NORMAL);
                return;
            }
            browserSessions.pumpLiveStream(sessionId);
        } catch (RuntimeException exception) {
            log.debug("Live browser pump failed. sessionId={}", sessionId);
        }
    }

    private void sendFrame(WebSocketSession socket, LiveBrowserFrame frame) {
        if (!socket.isOpen() || secureInputs.blocksCapture(frame.sessionId())) return;
        String metadata = "{\"type\":\"LIVE_BROWSER_FRAME\",\"sessionId\":\""
                + frame.sessionId() + "\",\"sequence\":" + frame.sequence()
                + ",\"width\":" + frame.width() + ",\"height\":" + frame.height()
                + ",\"mimeType\":\"image/jpeg\",\"byteLength\":" + frame.bytes().length + "}";
        try {
            synchronized (socket) {
                if (!socket.isOpen()) return;
                socket.sendMessage(new TextMessage(metadata));
                socket.sendMessage(new BinaryMessage(frame.bytes()));
            }
        } catch (IOException exception) {
            closeQuietly(socket, CloseStatus.SERVER_ERROR);
        }
    }

    private void sendStatus(WebSocketSession socket, String status, String detail) {
        try {
            synchronized (socket) {
                if (socket.isOpen()) socket.sendMessage(new TextMessage(
                        "{\"type\":\"" + status + "\",\"detail\":\"" + escape(detail) + "\"}"));
            }
        } catch (IOException ignored) { }
    }

    @Override
    public void afterConnectionClosed(WebSocketSession socket, CloseStatus status) {
        cleanup(socket);
    }

    @Override
    public void handleTransportError(WebSocketSession socket, Throwable exception) {
        cleanup(socket);
        closeQuietly(socket, CloseStatus.SERVER_ERROR);
    }

    private void cleanup(WebSocketSession socket) {
        String sessionId = sessionId(socket);
        if (sessionId == null || !connections.remove(sessionId, socket)) return;
        ScheduledFuture<?> pump = pumps.remove(sessionId);
        if (pump != null) pump.cancel(false);
        pumping.remove(sessionId);
        commands.submit(() -> {
            try { browserSessions.stopLiveStream(sessionId); }
            catch (RuntimeException ignored) { }
        });
    }

    private String sessionId(WebSocketSession socket) {
        Object value = socket.getAttributes().get(FrameWebSocketHandshakeInterceptor.SESSION_ID_ATTRIBUTE);
        return value instanceof String text && !text.isBlank() ? text : null;
    }

    private int coordinate(JsonObject input, String name, int max) {
        int value = input.get(name).getAsInt();
        if (value < 0 || value > max) throw new IllegalArgumentException("Invalid coordinate");
        return value;
    }

    private int delta(JsonObject input, String name) {
        int value = input.get(name).getAsInt();
        if (value < -3000 || value > 3000) throw new IllegalArgumentException("Invalid delta");
        return value;
    }

    private String requiredString(JsonObject input, String name, int maxLength) {
        String value = input.get(name).getAsString();
        if (value.isEmpty() || value.length() > maxLength) throw new IllegalArgumentException("Invalid text");
        return value;
    }

    private String escape(String value) {
        return value.replace("\\", "\\\\").replace("\"", "\\\"")
                .replace("\n", "\\n").replace("\r", "\\r");
    }

    private void closeQuietly(WebSocketSession socket, CloseStatus status) {
        try { if (socket.isOpen()) socket.close(status); } catch (IOException ignored) { }
    }

    @PreDestroy
    void close() {
        pumps.values().forEach(pump -> pump.cancel(false));
        pumps.clear();
        pumping.clear();
        scheduler.shutdownNow();
        commands.close();
    }
}
