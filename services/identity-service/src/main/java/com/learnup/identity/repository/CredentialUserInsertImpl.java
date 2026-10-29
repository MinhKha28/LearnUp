package com.learnup.identity.repository;

import com.learnup.identity.domain.User;
import jakarta.persistence.EntityManager;
import org.springframework.stereotype.Repository;

@Repository
public class CredentialUserInsertImpl implements CredentialUserInsert {
    private final EntityManager entityManager;

    public CredentialUserInsertImpl(EntityManager entityManager) {
        this.entityManager = entityManager;
    }

    @Override
    public void insertAndFlush(User user) {
        entityManager.persist(user);
        entityManager.flush();
    }
}
