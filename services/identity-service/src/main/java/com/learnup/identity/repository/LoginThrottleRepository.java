package com.learnup.identity.repository;

import com.learnup.identity.domain.LoginThrottle;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.Optional;

@Repository
public interface LoginThrottleRepository extends JpaRepository<LoginThrottle, String> {

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from LoginThrottle t where t.identifier = :identifier")
    Optional<LoginThrottle> findForUpdate(@Param("identifier") String identifier);
}
