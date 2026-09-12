package com.ddd.backend.security.navigation;

import org.springframework.stereotype.Component;

import java.net.InetAddress;
import java.net.URI;
import java.net.UnknownHostException;
import java.util.Locale;

/** Validates user supplied browser destinations before Chromium can request them. */
@Component
public final class PublicUrlNavigationPolicy {

    private static final int MAX_URL_LENGTH = 2_048;

    public URI resolve(String rawUrl) {
        if (rawUrl == null || rawUrl.isBlank() || rawUrl.length() > MAX_URL_LENGTH) {
            throw new IllegalArgumentException("targetUrl is required and must be at most 2048 characters");
        }

        final URI parsed;
        try {
            parsed = URI.create(rawUrl.trim());
        } catch (IllegalArgumentException exception) {
            throw new IllegalArgumentException("targetUrl is not a valid URL", exception);
        }

        if (!"https".equalsIgnoreCase(parsed.getScheme()) || parsed.getHost() == null
                || parsed.getUserInfo() != null) {
            throw new IllegalArgumentException("targetUrl must be a public HTTPS URL without user information");
        }

        validatePublicHost(parsed.getHost());

        try {
            // Fragments never belong in an HTTP request and are deliberately removed.
            String path = parsed.getRawPath();
            return new URI("https", null, parsed.getHost().toLowerCase(Locale.ROOT), parsed.getPort(),
                    path == null || path.isBlank() ? "/" : path,
                    parsed.getRawQuery(), null);
        } catch (Exception exception) {
            throw new IllegalArgumentException("targetUrl could not be normalized", exception);
        }
    }

    public void validateRequestUrl(String rawUrl) {
        resolve(rawUrl);
    }

    private void validatePublicHost(String rawHost) {
        String host = rawHost.toLowerCase(Locale.ROOT);
        if (host.startsWith("[") && host.endsWith("]")) {
            host = host.substring(1, host.length() - 1);
        }
        if (host.equals("localhost") || host.endsWith(".localhost") || host.endsWith(".local")
                || host.endsWith(".internal") || host.equals("metadata.google.internal")) {
            throw new IllegalArgumentException("targetUrl host is not public");
        }

        final InetAddress[] addresses;
        try {
            addresses = InetAddress.getAllByName(host);
        } catch (UnknownHostException exception) {
            throw new IllegalArgumentException("targetUrl host could not be resolved", exception);
        }
        if (addresses.length == 0) {
            throw new IllegalArgumentException("targetUrl host could not be resolved");
        }
        for (InetAddress address : addresses) {
            if (address.isAnyLocalAddress() || address.isLoopbackAddress()
                    || address.isLinkLocalAddress() || address.isSiteLocalAddress()
                    || address.isMulticastAddress() || isCarrierGradeNat(address)
                    || isUniqueLocalIpv6(address) || isDocumentationOrReserved(address)) {
                throw new IllegalArgumentException("targetUrl resolves to a non-public address");
            }
        }
    }

    private boolean isCarrierGradeNat(InetAddress address) {
        byte[] bytes = address.getAddress();
        return bytes.length == 4 && (bytes[0] & 0xff) == 100 && ((bytes[1] & 0xc0) == 64);
    }

    private boolean isUniqueLocalIpv6(InetAddress address) {
        byte[] bytes = address.getAddress();
        return bytes.length == 16 && ((bytes[0] & 0xfe) == 0xfc);
    }

    private boolean isDocumentationOrReserved(InetAddress address) {
        byte[] bytes = address.getAddress();
        if (bytes.length != 4) return false;
        int first = bytes[0] & 0xff;
        int second = bytes[1] & 0xff;
        int third = bytes[2] & 0xff;
        return first == 0 || first >= 224
                || (first == 192 && second == 0 && third == 0)
                || (first == 192 && second == 0 && third == 2)
                || (first == 198 && second == 51 && third == 100)
                || (first == 203 && second == 0 && third == 113);
    }
}
