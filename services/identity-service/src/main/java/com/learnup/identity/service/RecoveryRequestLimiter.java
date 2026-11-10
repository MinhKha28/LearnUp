package com.learnup.identity.service;

import com.learnup.identity.config.PasswordRecoveryProperties;
import com.learnup.identity.domain.LoginThrottle;
import com.learnup.identity.repository.LoginThrottleRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;
import java.time.temporal.ChronoUnit;
import java.util.UUID;

/** A separate namespace in the existing throttle store; callers must hold the account row lock. */
@Service
public class RecoveryRequestLimiter {
    private final LoginThrottleRepository repository;
    private final PasswordRecoveryProperties properties;

    public RecoveryRequestLimiter(LoginThrottleRepository repository, PasswordRecoveryProperties properties) {
        this.repository = repository;
        this.properties = properties;
    }

    @Transactional(propagation = Propagation.MANDATORY)
    public boolean allow(UUID userId, Instant now) {
        // LoginThrottleService always lowercases public identifiers. An uppercase domain marker
        // makes these keys disjoint even when an attacker submits the entire marker as a username.
        String key = "PASSWORD_RECOVERY/v1/" + userId;
        LoginThrottle counter = repository.findForUpdate(key).orElseGet(() -> new LoginThrottle(key, now));
        if (!counter.getWindowStartedAt().plus(properties.getWindowMinutes(), ChronoUnit.MINUTES).isAfter(now)) {
            counter.setWindowStartedAt(now);
            counter.setFailedCount(0);
        }
        if (counter.getFailedCount() >= properties.getMaxRequestsPerWindow()) {
            return false;
        }
        counter.setFailedCount(counter.getFailedCount() + 1);
        repository.save(counter);
        return true;
    }
}
