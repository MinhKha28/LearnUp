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
        Instant now = Instant.now();
        loginThrottleRepository.findById(key(identifier))
                .map(LoginThrottle::getLockedUntil)
                .filter(lockedUntil -> lockedUntil.isAfter(now))
                .ifPresent(lockedUntil -> {
                    throw new TooManyAttemptsException(Duration.between(now, lockedUntil).toSeconds() + 1);
                });
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void recordFailure(String identifier) {
        Instant now = Instant.now();
        String key = key(identifier);
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
            log.warn("Sign-in locked for {} minutes after {} failed attempts", lockDuration.toMinutes(), maxFailures);
        }
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void reset(String identifier) {
        loginThrottleRepository.deleteById(key(identifier));
    }

    private static String key(String identifier) {
        return identifier.trim().toLowerCase(Locale.ROOT);
    }
}
