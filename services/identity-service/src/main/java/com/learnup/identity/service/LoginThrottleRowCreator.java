package com.learnup.identity.service;

import com.learnup.identity.domain.LoginThrottle;
import com.learnup.identity.repository.LoginThrottleRepository;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Component
public class LoginThrottleRowCreator {

    private final LoginThrottleRepository loginThrottleRepository;

    public LoginThrottleRowCreator(LoginThrottleRepository loginThrottleRepository) {
        this.loginThrottleRepository = loginThrottleRepository;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void createIfAbsent(String identifier, Instant now) {
        if (!loginThrottleRepository.existsById(identifier)) {
            loginThrottleRepository.saveAndFlush(new LoginThrottle(identifier, now));
        }
    }
}
