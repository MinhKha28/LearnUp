package com.learnup.identity.dto.internal;

import com.fasterxml.jackson.annotation.JsonIgnoreProperties;

@JsonIgnoreProperties(ignoreUnknown = true)
public record SignInAccess(boolean allowed, String accessMode, String reason) {
}
