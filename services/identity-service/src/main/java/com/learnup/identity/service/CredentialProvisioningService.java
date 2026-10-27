package com.learnup.identity.service;

import com.learnup.common.exception.BusinessException;
import com.learnup.common.security.UserRole;
import com.learnup.identity.client.TenantAccessClient;
import com.learnup.identity.domain.User;
import com.learnup.identity.dto.internal.SetCredentialsRequest;
import com.learnup.identity.exception.CredentialProvisioningConflictException;
import com.learnup.identity.repository.PasswordResetTokenRepository;
import com.learnup.identity.repository.RefreshTokenRepository;
import com.learnup.identity.repository.UserRepository;
import jakarta.validation.Validator;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.dao.ConcurrencyFailureException;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.dao.QueryTimeoutException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.TransactionTimedOutException;
import org.springframework.transaction.support.TransactionTemplate;

import java.time.Instant;
import java.util.List;
import java.util.Locale;
import java.util.UUID;

/** Identity-only atomic transition. Tenant owns deletion/eligibility; a different ID is never proof. */
@Service
public class CredentialProvisioningService {
    private static final Logger log = LoggerFactory.getLogger(CredentialProvisioningService.class);
    private final UserRepository users;
    private final PasswordResetTokenRepository recovery;
    private final RefreshTokenRepository sessions;
    private final TenantAccessClient tenant;
    private final PasswordEncoder passwords;
    private final Validator validator;
    private final TransactionTemplate transaction;

    public CredentialProvisioningService(UserRepository users, PasswordResetTokenRepository recovery,
                                         RefreshTokenRepository sessions, TenantAccessClient tenant,
                                         PasswordEncoder passwords, Validator validator,
                                         PlatformTransactionManager transactions) {
        this.users = users;
        this.recovery = recovery;
        this.sessions = sessions;
        this.tenant = tenant;
        this.passwords = passwords;
        this.validator = validator;
        this.transaction = new TransactionTemplate(transactions);
        // Bounds database waits, including unique-index contention on rows that do not yet exist.
        this.transaction.setTimeout(10);
    }

    public void setCredentials(SetCredentialsRequest request) {
        if (request == null || !validator.validate(request).isEmpty()) {
            throw BusinessException.badRequest("Invalid credential provisioning request");
        }
        String email = request.getEmail() == null || request.getEmail().isBlank()
                ? null : request.getEmail().trim().toLowerCase(Locale.ROOT);
        try {
            // Translate failures outside execute so rollback/commit failures are covered too.
            transaction.executeWithoutResult(status -> provision(request, email));
        } catch (DataIntegrityViolationException | ConcurrencyFailureException | QueryTimeoutException
                 | TransactionTimedOutException conflict) {
            throw CredentialProvisioningConflictException.concurrentClaim();
        }
        log.info("Credentials successfully set for user [{}]", request.getUserId());
    }

    private void provision(SetCredentialsRequest request, String email) {
        UUID userId = request.getUserId();
        List<UUID> snapshot = email == null ? List.of() : users.findEmailOwnerIds(email);
        if (snapshot.size() > 1) {
            // Legacy case variants cannot be attributed to a single owner safely.
            throw CredentialProvisioningConflictException.emailInUse();
        }
        UUID previousId = snapshot.isEmpty() ? null : snapshot.getFirst();
        User user;
        User previous = null;
        if (previousId != null && !previousId.equals(userId)) {
            List<User> locked = users.findCredentialOwnersForUpdate(List.of(userId, previousId));
            user = locked.stream().filter(candidate -> candidate.getId().equals(userId)).findFirst().orElse(null);
            previous = locked.stream().filter(candidate -> candidate.getId().equals(previousId)).findFirst().orElse(null);
            if (previous == null || previous.getEmail() == null
                    || !email.equals(previous.getEmail().trim().toLowerCase(Locale.ROOT))) {
                throw CredentialProvisioningConflictException.concurrentClaim();
            }
        } else {
            // Preserve supported same-user password/reset/refresh serialization, before token-row locks.
            user = users.findByIdForUpdate(userId).orElse(null);
        }
        if (email != null && !snapshot.equals(users.findEmailOwnerIds(email))) {
            // Never reinterpret a newly appeared owner as a deletable/orphaned user.
            throw CredentialProvisioningConflictException.concurrentClaim();
        }
        if (email == null && (user == null || user.getEmail() == null)) {
            throw BusinessException.badRequest("A valid email is required for credential provisioning");
        }
        if (previous != null) {
            if (tenant.exists(previous.getId())) {
                throw CredentialProvisioningConflictException.emailInUse();
            }
            previous.setEmail(null);
            // Release before INSERT/UPDATE claims it; this flush still rolls back with every later write.
            users.saveAndFlush(previous);
        }
        boolean creating = user == null;
        if (creating) {
            user = new User();
            user.setId(userId);
            user.setUsername(request.getUsername() == null || request.getUsername().isBlank()
                    ? AuthService.defaultUsername(userId) : request.getUsername().trim());
            user.setEmail(email);
            user.setFullName(request.getFullName());
            user.setRole(request.getRole() == null ? UserRole.LEARNER : request.getRole());
            user.setOrganizationId(request.getOrganizationId());
            user.setEnabled(true);
            user.setCreatedAt(Instant.now());
        } else {
            if (request.getUsername() != null && !request.getUsername().isBlank()) {
                user.setUsername(request.getUsername().trim());
            }
            if (email != null) user.setEmail(email);
            if (request.getRole() != null) user.setRole(request.getRole());
            if (request.getOrganizationId() != null) user.setOrganizationId(request.getOrganizationId());
        }
        user.setPasswordHash(passwords.encode(request.getPassword().trim()));
        user.setUpdatedAt(Instant.now());
        if (creating) {
            // Assigned UUIDs must not make JPA merge overwrite a newly appeared canonical record.
            users.insertAndFlush(user);
        } else {
            users.saveAndFlush(user);
        }
        // Only the requester undergoes existing credential-replacement token invalidation.
        recovery.deleteByUserId(userId);
        sessions.deleteByUserId(userId);
    }
}
