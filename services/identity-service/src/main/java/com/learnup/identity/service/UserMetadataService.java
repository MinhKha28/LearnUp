package com.learnup.identity.service;

import com.learnup.common.exception.BusinessException;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.internal.UpdateUserMetadataRequest;
import com.learnup.identity.repository.UserRepository;
import com.learnup.identity.security.AuthenticationDiagnostics;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.util.Locale;

/** Existing-user metadata only; deliberately has no credential/token repositories or handoff path. */
@Service
public class UserMetadataService {
    private static final Logger log = LoggerFactory.getLogger(UserMetadataService.class);
    private final UserRepository users;

    public UserMetadataService(UserRepository users) {
        this.users = users;
    }

    @Transactional
    public void update(UpdateUserMetadataRequest request) {
        // Share the account lock/order used by password and refresh operations.
        User user = users.findByIdForUpdate(request.userId())
                .orElseThrow(() -> BusinessException.notFound("Identity user not found"));
        String email = request.email().trim().toLowerCase(Locale.ROOT);
        if (users.existsByEmailIgnoreCaseAndIdNot(email, user.getId())) {
            throw BusinessException.conflict("Email belongs to another Identity user");
        }

        user.setEmail(email);
        user.setRole(request.role());
        user.setFullName(request.fullName());
        user.setOrganizationId(request.organizationId());
        try {
            // The unique email constraint, not the preflight, arbitrates concurrent claims.
            // Flush here so the conflict is translated before leaving the transaction.
            users.saveAndFlush(user);
        } catch (DataIntegrityViolationException conflict) {
            // Throwing an unchecked application exception rolls the entire transaction back.
            // Never forward SQL messages, row contents or another owner's identity.
            throw BusinessException.conflict("Metadata conflicts with an existing Identity user");
        }
        log.info("event=identity_metadata_updated user_id={} correlation_id={}",
                user.getId(), AuthenticationDiagnostics.correlationId());
    }
}
