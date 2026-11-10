package com.learnup.identity.repository;

import com.learnup.identity.domain.User;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;
import java.util.List;
import java.util.UUID;

@Repository
public interface UserRepository extends JpaRepository<User, UUID>, CredentialUserInsert {

    Optional<User> findByUsername(String username);

    Optional<User> findByEmail(String email);

    Optional<User> findByUsernameOrEmail(String username, String email);

    // Serialize credential changes and token issuance on the account, before any token-row locks.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.id = :id")
    Optional<User> findByIdForUpdate(@Param("id") UUID id);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select u from User u where u.email = :email")
    Optional<User> findByEmailForUpdate(@Param("email") String email);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    // Released usernames cannot authenticate or shadow the current owner's email login.
    @Query("select u from User u where u.email is not null and (u.username = :username or u.email = :email)")
    Optional<User> findByUsernameOrEmailForUpdate(@Param("username") String username, @Param("email") String email);

    boolean existsByUsername(String username);

    boolean existsByEmail(String email);

    boolean existsByEmailIgnoreCaseAndIdNot(String email, UUID id);

    // Scalar snapshot avoids stale managed entities when ownership changes before locking.
    @Query("select u.id from User u where lower(u.email) = :email order by u.id")
    List<UUID> findEmailOwnerIds(@Param("email") String email);

    // Cross-user operations take all existing account locks in one stable order, without waiting.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "0"))
    @Query("select u from User u where u.id in :ids order by u.id")
    List<User> findCredentialOwnersForUpdate(@Param("ids") List<UUID> ids);
}
