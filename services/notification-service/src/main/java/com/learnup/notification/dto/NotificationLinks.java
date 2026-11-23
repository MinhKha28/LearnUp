package com.learnup.notification.dto;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.DeserializationFeature;
import com.fasterxml.jackson.databind.ObjectMapper;

public final class NotificationLinks {
    private static final ObjectMapper MAPPER = new ObjectMapper()
            .enable(DeserializationFeature.FAIL_ON_TRAILING_TOKENS);

    private NotificationLinks() { }

    /** Expose only internal destinations so producer metadata cannot redirect recipients outside the app. */
    public static String fromMetadata(String metadata) {
        if (metadata == null || metadata.isBlank()) return null;
        try {
            JsonNode root = MAPPER.readTree(metadata);
            if (root == null || !root.isObject()) return null;
            JsonNode value = root.get("link");
            if (value == null || !value.isTextual()) return null;
            String link = value.textValue();
            if (!link.startsWith("/") || link.startsWith("//") || link.indexOf('\\') >= 0) return null;
            if (link.codePoints().anyMatch(character -> Character.isWhitespace(character)
                    || Character.isSpaceChar(character) || Character.isISOControl(character))) return null;
            return link;
        } catch (JsonProcessingException malformed) {
            return null;
        }
    }
}
