package com.learnup.identity.service;

import com.learnup.identity.repository.PasswordResetTokenRepository;
import com.learnup.identity.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;

import java.util.UUID;

/** Short transactions only: no database lock is held during Tenant or Notification HTTP calls. */
@Service
public class RecoveryDeliveryState {
    private final PasswordResetTokenRepository tokens;
    private final UserRepository users;

    public RecoveryDeliveryState(PasswordResetTokenRepository tokens, UserRepository users) {
        this.tokens = tokens;
        this.users = users;
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW, readOnly = true)
    public boolean isDeliverable(UUID userId, UUID tokenId, String email) {
        return email != null && users.findById(userId)
                .filter(user -> user.isEnabled() && email.equals(user.getEmail())).isPresent()
                && tokens.findById(tokenId).filter(token -> token.getUserId().equals(userId) && token.isValid()).isPresent();
    }

    @Transactional(propagation = Propagation.REQUIRES_NEW)
    public void revoke(UUID userId, UUID tokenId) {
        // Same User -> Token order as issuance/reset; never revoke a newer recovery request.
        // An obsolete delivery after BR-31 must not erase the retained former owner's recovery record.
        if (users.findByIdForUpdate(userId).filter(user -> user.getEmail() != null).isPresent()) {
            tokens.deleteDeliveryToken(tokenId, userId);
        }
    }
}
