package com.ddd.backend.security.navigation;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class PublicUrlNavigationPolicyTest {

    private final PublicUrlNavigationPolicy policy = new PublicUrlNavigationPolicy();

    @Test
    void acceptsAndNormalizesPublicHttpsAddress() {
        assertThat(policy.resolve("https://8.8.8.8/search?q=test#result").toString())
                .isEqualTo("https://8.8.8.8/search?q=test");
    }

    @Test
    void rejectsNonHttpsAndPrivateDestinations() {
        assertThatThrownBy(() -> policy.resolve("http://8.8.8.8"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> policy.resolve("https://127.0.0.1"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> policy.resolve("https://10.0.0.1"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> policy.resolve("https://[fc00::1]"))
                .isInstanceOf(IllegalArgumentException.class);
        assertThatThrownBy(() -> policy.resolve("https://service.railway.internal"))
                .isInstanceOf(IllegalArgumentException.class);
    }

    @Test
    void rejectsCredentialsInUrl() {
        assertThatThrownBy(() -> policy.resolve("https://user:secret@8.8.8.8"))
                .isInstanceOf(IllegalArgumentException.class);
    }
}
