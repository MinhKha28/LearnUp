package com.learnup.identity.service;

import org.flywaydb.core.Flyway;
import org.flywaydb.core.api.MigrationVersion;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfEnvironmentVariable;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.test.annotation.DirtiesContext;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;

import javax.sql.DataSource;
import java.sql.Timestamp;
import java.time.Instant;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

/** Forward migration of populated V4 tables inside a new schema of the guarded disposable test database. */
@SpringBootTest
@ActiveProfiles({"test", "postgres-test"})
@DirtiesContext(classMode = DirtiesContext.ClassMode.AFTER_CLASS)
@EnabledIfEnvironmentVariable(named = "IDENTITY_TEST_POSTGRES_URL", matches = ".+")
class CredentialEmailMigrationPostgresTest {
    @Autowired DataSource dataSource;
    @Autowired JdbcTemplate jdbc;

    @DynamicPropertySource
    static void disposableDatabase(DynamicPropertyRegistry properties) {
        PasswordResetPostgresIntegrationTest.disposableDatabase(properties);
    }

    @Test
    void v5PreservesEveryExistingValueAndForeignKeyWhileAllowingReleasedNullClaims() {
        String schema = "br31_migration_" + UUID.randomUUID().toString().replace("-", "");
        Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                .locations("classpath:db/migration").target(MigrationVersion.fromVersion("4"))
                .cleanDisabled(true).load().migrate();
        UUID first = UUID.randomUUID();
        UUID second = UUID.randomUUID();
        insertUser(schema, first, "first@migration.invalid");
        insertUser(schema, second, "second@migration.invalid");
        Timestamp created = Timestamp.from(Instant.parse("2020-01-01T00:00:00Z"));
        Timestamp expires = Timestamp.from(Instant.parse("2035-01-01T00:00:00Z"));
        UUID session = UUID.randomUUID();
        jdbc.update("INSERT INTO " + schema + ".refresh_tokens "
                        + "(id, user_id, token_hash, expires_at, created_at, family_id) VALUES (?, ?, ?, ?, ?, ?)",
                session, first, "synthetic-migration-session-hash", expires, created, session);
        jdbc.update("INSERT INTO " + schema + ".password_reset_tokens "
                        + "(id, user_id, token_hash, expires_at, created_at) VALUES (?, ?, ?, ?, ?)",
                UUID.randomUUID(), first, "synthetic-migration-recovery-hash", expires, created);
        var before = jdbc.queryForList("SELECT * FROM " + schema + ".users ORDER BY id");
        var sessionsBefore = jdbc.queryForList("SELECT * FROM " + schema + ".refresh_tokens ORDER BY id");
        var recoveryBefore = jdbc.queryForList("SELECT * FROM " + schema + ".password_reset_tokens ORDER BY id");

        Flyway latest = Flyway.configure().dataSource(dataSource).schemas(schema).defaultSchema(schema)
                .locations("classpath:db/migration").cleanDisabled(true).load();
        assertThat(latest.migrate().migrationsExecuted).isOne();
        assertThat(latest.info().current().getVersion().getVersion()).isEqualTo("5");
        assertThat(jdbc.queryForList("SELECT * FROM " + schema + ".users ORDER BY id")).isEqualTo(before);
        assertThat(jdbc.queryForList("SELECT * FROM " + schema + ".refresh_tokens ORDER BY id")).isEqualTo(sessionsBefore);
        assertThat(jdbc.queryForList("SELECT * FROM " + schema + ".password_reset_tokens ORDER BY id")).isEqualTo(recoveryBefore);
        assertThat(jdbc.queryForObject("SELECT is_nullable FROM information_schema.columns "
                + "WHERE table_schema = ? AND table_name = 'users' AND column_name = 'email'", String.class, schema)).isEqualTo("YES");
        assertThat(jdbc.queryForObject("SELECT count(*) FROM information_schema.table_constraints "
                + "WHERE constraint_schema = ? AND table_name = 'users' AND constraint_name = 'users_email_key' "
                + "AND constraint_type = 'UNIQUE'", Integer.class, schema)).isOne();
        assertThatThrownBy(() -> insertUser(schema, UUID.randomUUID(), "first@migration.invalid"))
                .isInstanceOf(DataIntegrityViolationException.class);

        assertThat(jdbc.update("UPDATE " + schema + ".users SET email = NULL WHERE id IN (?, ?)", first, second)).isEqualTo(2);
        insertUser(schema, UUID.randomUUID(), "first@migration.invalid");
        assertThatThrownBy(() -> insertUser(schema, UUID.randomUUID(), "first@migration.invalid"))
                .isInstanceOf(DataIntegrityViolationException.class);
        assertThat(jdbc.queryForObject("SELECT count(*) FROM " + schema + ".users WHERE email IS NULL", Integer.class)).isEqualTo(2);
        assertThat(jdbc.queryForList("SELECT * FROM " + schema + ".refresh_tokens ORDER BY id")).isEqualTo(sessionsBefore);
        assertThat(jdbc.queryForList("SELECT * FROM " + schema + ".password_reset_tokens ORDER BY id")).isEqualTo(recoveryBefore);
    }

    private void insertUser(String schema, UUID id, String email) {
        Timestamp created = Timestamp.from(Instant.parse("2020-01-01T00:00:00Z"));
        jdbc.update("INSERT INTO " + schema + ".users "
                        + "(id, username, email, password_hash, role, enabled, created_at, updated_at) "
                        + "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                id, "user_" + id, email, "synthetic-migration-password-hash", "LEARNER", true, created, created);
    }
}
