package com.learnup.identity.service;

import com.learnup.identity.domain.LoginThrottle;
import com.learnup.identity.exception.TooManyAttemptsException;
import com.learnup.identity.repository.LoginThrottleRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Duration;
import java.time.Instant;
import java.util.Locale;
import java.util.UUID;

@Service
public class LoginThrottleService {

    private static final Logger log = LoggerFactory.getLogger(LoginThrottleService.class);

    private final LoginThrottleRepository loginThrottleRepository;
    private final LoginThrottleRowCreator loginThrottleRowCreator;
    private final int maxFailures;
    private final Duration window;
    private final Duration lockDuration;

    public LoginThrottleService(LoginThrottleRepository loginThrottleRepository,
                                LoginThrottleRowCreator loginThrottleRowCreator,
                                @Value("${security.login-throttle.max-failures:5}") int maxFailures,
                                @Value("${security.login-throttle.window-minutes:15}") long windowMinutes,
                                @Value("${security.login-throttle.lock-minutes:15}") long lockMinutes) {
        this.loginThrottleRepository = loginThrottleRepository;
        this.loginThrottleRowCreator = loginThrottleRowCreator;
        this.maxFailures = maxFailures;
        this.window = Duration.ofMinutes(windowMinutes);
        this.lockDuration = Duration.ofMinutes(lockMinutes);
    }

    @Transactional(readOnly = true)
    public void assertNotLocked(String identifier) {
        assertKeyNotLocked(key(identifier), false);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(String identifier) {
        recordKeyFailure(key(identifier));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reset(String identifier) {
        loginThrottleRepository.deleteById(key(identifier));
    }

    /** UC08: incorrect current-password checks are throttled per account, separately from sign-in. */
    @Transactional(readOnly = true)
    public void assertPasswordChangeNotLocked(UUID userId) {
        assertKeyNotLocked(passwordChangeKey(userId), true);
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordPasswordChangeFailure(UUID userId) {
        recordKeyFailure(passwordChangeKey(userId));
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void resetPasswordChange(UUID userId) {
        loginThrottleRepository.deleteById(passwordChangeKey(userId));
    }

    private void assertKeyNotLocked(String key, boolean passwordChange) {
        Instant now = Instant.now();
        loginThrottleRepository.findById(key)
                .map(LoginThrottle::getLockedUntil)
                .filter(lockedUntil -> lockedUntil.isAfter(now))
                .ifPresent(lockedUntil -> {
                    long retryAfter = Duration.between(now, lockedUntil).toSeconds() + 1;
                    throw passwordChange
                            ? TooManyAttemptsException.passwordChange(retryAfter)
                            : new TooManyAttemptsException(retryAfter);
                });
    }

    private void recordKeyFailure(String key) {
        Instant now = Instant.now();
        try {
            loginThrottleRowCreator.createIfAbsent(key, now);
        } catch (DataIntegrityViolationException ignored) {
        }
        LoginThrottle throttle = loginThrottleRepository.findForUpdate(key).orElseThrow();

        if (throttle.getWindowStartedAt().plus(window).isBefore(now)) {
            throttle.setFailedCount(0);
            throttle.setWindowStartedAt(now);
        }
        throttle.setFailedCount(throttle.getFailedCount() + 1);

        if (throttle.getFailedCount() >= maxFailures) {
            throttle.setLockedUntil(now.plus(lockDuration));
            throttle.setFailedCount(0);
            throttle.setWindowStartedAt(now);
            log.warn("Attempts locked for {} minutes after {} failed attempts", lockDuration.toMinutes(), maxFailures);
        }
    }

    private static String key(String identifier) {
        return identifier.trim().toLowerCase(Locale.ROOT);
    }

    /**
     * Sign-in keys are always lower-cased, so this upper-case namespace can never be produced
     * (or locked) by a sign-in attempt with a crafted identifier.
     */
    static String passwordChangeKey(UUID userId) {
        return "PASSWORD-CHANGE:" + userId;
    }
}
