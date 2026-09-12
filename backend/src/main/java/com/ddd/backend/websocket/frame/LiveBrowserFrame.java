package com.ddd.backend.websocket.frame;

public record LiveBrowserFrame(
        String sessionId,
        long sequence,
        int width,
        int height,
        byte[] bytes
) { }
