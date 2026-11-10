package com.learnup.identity.support;

import com.zaxxer.hikari.SQLExceptionOverride;

import java.sql.SQLException;

/** H2 row-lock timeouts are recoverable: retain the connection so the transaction can roll back. */
public class H2LockTimeoutExceptionOverride implements SQLExceptionOverride {
    @java.lang.Override
    public Override adjudicate(SQLException failure) {
        return failure instanceof org.h2.jdbc.JdbcSQLTimeoutException
                && "HYT00".equals(failure.getSQLState()) && failure.getErrorCode() == 50200
                ? Override.DO_NOT_EVICT : Override.CONTINUE_EVICT;
    }
}
