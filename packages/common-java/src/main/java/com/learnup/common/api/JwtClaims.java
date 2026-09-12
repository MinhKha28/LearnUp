package com.learnup.common.api;

import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Data;
import lombok.NoArgsConstructor;

/**
 * Standardized JWT claims model in Java.
 */
@Data
@Builder
@NoArgsConstructor
@AllArgsConstructor
public class JwtClaims {

    private String sub;
    private String role;
    private String organizationId;
    private Long iat;
    private Long exp;
    private String iss;
    private String aud;
}
