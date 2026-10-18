package com.learnup.identity.repository;

import com.learnup.identity.domain.PasswordResetToken;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.time.Instant;
import java.util.Optional;
import java.util.UUID;

@Repository
public interface PasswordResetTokenRepository extends JpaRepository<PasswordResetToken, UUID> {

    Optional<PasswordResetToken> findByTokenHash(String tokenHash);

    // Resolve ownership without hydrating a stale token before waiting for the account lock.
    @Query("select t.userId from PasswordResetToken t where t.tokenHash = :tokenHash")
    Optional<UUID> findUserIdByTokenHash(@Param("tokenHash") String tokenHash);

    @Modifying(flushAutomatically = true)
    @Query("delete from PasswordResetToken t where t.tokenHash = :tokenHash and t.userId = :userId "
            + "and t.usedAt is null and t.expiresAt > :now")
    int consumeUsableToken(@Param("tokenHash") String tokenHash, @Param("userId") UUID userId, @Param("now") Instant now);

    // Deletion is revocation: retain no outstanding recovery authority after credential replacement.
    @Modifying(flushAutomatically = true)
    @Query("delete from PasswordResetToken t where t.userId = :userId")
    void deleteByUserId(@Param("userId") UUID userId);
}
