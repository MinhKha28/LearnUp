package com.learnup.identity.service;

import com.learnup.common.exception.BusinessException;
import com.learnup.common.security.UserRole;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.AuthResponse;
import com.learnup.identity.dto.internal.SignInAccess;
import com.learnup.identity.exception.GoogleSignInException;
import com.learnup.identity.exception.SignInDeniedException;
import com.learnup.identity.repository.UserRepository;
import com.learnup.identity.security.AuthenticationDiagnostics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

/**
 * UC05.1 Sign in with Google. BR-36: Organizer, Instructor and Learner only (never the platform
 * Admin). BR-37: sign-in only; a Google email without an existing non-deleted LearnUP account is
 * rejected and no account is created. Eligibility uses the same Tenant check as UC05 (BR-35).
 */
@Service
public class GoogleSignInService {

    private static final Logger log = LoggerFactory.getLogger(GoogleSignInService.class);

    private final GoogleIdTokenVerifier verifier;
    private final UserRepository userRepository;
    private final TenantAccessClient tenantAccessClient;
    private final AuthService authService;

    public GoogleSignInService(GoogleIdTokenVerifier verifier, UserRepository userRepository,
                               TenantAccessClient tenantAccessClient, AuthService authService) {
        this.verifier = verifier;
        this.userRepository = userRepository;
        this.tenantAccessClient = tenantAccessClient;
        this.authService = authService;
    }

    @Transactional
    public AuthResponse signIn(String credential) {
        GoogleIdTokenVerifier.VerifiedGoogleIdentity identity = verifier.verify(credential);

        // BR-38/BR-39: the verified email identifies at most one non-deleted credential; released
        // credentials have a NULL email and can never match.
        User user = userRepository.findByEmailForUpdate(identity.email()).orElse(null);
        if (user == null) {
            log.warn("event=google_login_rejected reason=ACCOUNT_NOT_LINKED correlation_id={}", AuthenticationDiagnostics.correlationId());
            throw GoogleSignInException.accountNotLinked();
        }
        if (user.getRole() == UserRole.ADMIN) {
            log.warn("event=google_login_rejected reason=ROLE_NOT_ALLOWED user_id={} correlation_id={}",
                    user.getId(), AuthenticationDiagnostics.correlationId());
            throw GoogleSignInException.notAllowed();
        }
        if (!user.isEnabled()) {
            log.warn("event=google_login_rejected reason=ACCOUNT_DISABLED user_id={} correlation_id={}",
                    user.getId(), AuthenticationDiagnostics.correlationId());
            throw BusinessException.unauthorized("User account is disabled");
        }

        SignInAccess access = tenantAccessClient.check(user.getId());
        if (!access.allowed()) {
            log.warn("event=google_login_rejected reason={} user_id={} correlation_id={}",
                    SignInDeniedException.normalizeReason(access.reason()), user.getId(), AuthenticationDiagnostics.correlationId());
            if ("ACCOUNT_NOT_FOUND".equals(access.reason())) {
                throw GoogleSignInException.accountNotLinked();
            }
            throw new SignInDeniedException(access.reason());
        }

        log.info("event=google_login_succeeded user_id={} correlation_id={}", user.getId(), AuthenticationDiagnostics.correlationId());
        return authService.issueSession(user, access);
    }
}
