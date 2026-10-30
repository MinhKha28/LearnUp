package com.learnup.audit.security;

import com.learnup.common.exception.BusinessException;
import com.learnup.common.security.UserRole;
import jakarta.servlet.http.HttpServletRequest;

import java.util.UUID;

/**
 * The person who reads the audit trail, as the gateway described them (UC50, UC51). An Admin reads every entry; an Organizer
 * reads only the entries of the own Organization. Nobody else reads the trail.
 */
public record AuditCaller(UserRole role, UUID organizationId) {

    static final String REQUEST_ATTRIBUTE = AuditCaller.class.getName();

    /** Defense in depth: the filter already refused everybody else, so a missing caller means a request that skipped it. */
    public static AuditCaller require(HttpServletRequest request) {
        Object caller = request.getAttribute(REQUEST_ATTRIBUTE);
        if (!(caller instanceof AuditCaller found)) {
            throw BusinessException.forbidden("Only an Admin or an Organizer can read the audit trail");
        }
        return found;
    }

    /** The Organization a query is limited to: the own one for an Organizer (asking for another one is refused), any for an Admin. */
    public UUID scopeOf(UUID requestedOrganizationId) {
        if (role != UserRole.ORGANIZER) {
            return requestedOrganizationId;
        }
        if (requestedOrganizationId != null && !requestedOrganizationId.equals(organizationId)) {
            throw BusinessException.forbidden("An Organizer reads only the audit trail of the own Organization");
        }
        return organizationId;
    }

    /** True when the caller may see an entry of the given Organization (an Organizer never sees another one or a platform entry). */
    public boolean mayRead(UUID entryOrganizationId) {
        return role == UserRole.ADMIN || organizationId.equals(entryOrganizationId);
    }
}
