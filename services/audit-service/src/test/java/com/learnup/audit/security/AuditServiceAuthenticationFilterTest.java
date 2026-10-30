package com.learnup.audit.security;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.nio.charset.StandardCharsets;

import static org.junit.jupiter.api.Assertions.*;

/** The service does not start without a private key: a missing, short or default key would leave the audit API open. */
class AuditServiceAuthenticationFilterTest {

    private static final ObjectMapper MAPPER = new ObjectMapper();

    private static AuditServiceAuthenticationFilter filter(String key) {
        return new AuditServiceAuthenticationFilter(key, MAPPER);
    }

    @Test
    @DisplayName("a missing, blank, short or default key stops the start")
    void refusesWeakKeys() {
        for (String key : new String[]{null, "", "   ", "short", "x".repeat(31), "learnup-internal-secret", " learnup-internal-secret "}) {
            assertThrows(IllegalStateException.class, () -> filter(key), "key: " + key);
        }
    }

    @Test
    @DisplayName("31 bytes are too few and 32 bytes are accepted (bytes, not characters)")
    void countsBytes() {
        assertThrows(IllegalStateException.class, () -> filter("a".repeat(31)));
        assertDoesNotThrow(() -> filter("a".repeat(32)));
        // 16 two-byte characters are 32 bytes
        String twoBytes = "é".repeat(16);
        assertEquals(32, twoBytes.getBytes(StandardCharsets.UTF_8).length);
        assertDoesNotThrow(() -> filter(twoBytes));
    }

    @Test
    @DisplayName("the error message never contains the key")
    void messageDoesNotContainTheKey() {
        IllegalStateException error = assertThrows(IllegalStateException.class, () -> filter("short-secret-value"));
        assertFalse(error.getMessage().contains("short-secret-value"));
    }
}
