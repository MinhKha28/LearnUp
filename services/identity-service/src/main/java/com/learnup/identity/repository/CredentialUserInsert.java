package com.learnup.identity.repository;

import com.learnup.identity.domain.User;

/** Creation must INSERT, never merge over an account created after the provisioning read. */
public interface CredentialUserInsert {
    void insertAndFlush(User user);
}
