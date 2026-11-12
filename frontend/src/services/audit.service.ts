import axios from "@/services/axios.customize";
import type { IAuditLogPage, IAuditLogQuery } from "@/types/audit.types";
import { AUDIT_PAGE_SIZE, dayEndExclusiveInstant, dayStartInstant } from "@/utils/audit.log";

/** The query as the server reads it: `page` starts at 0 and the time range is `from` included to `to` excluded. */
export const buildAuditParams = ({ page, pageSize = AUDIT_PAGE_SIZE, targetResourceType, targetResourceId, from, to }: IAuditLogQuery) => ({
  page: page - 1,
  size: pageSize,
  ...(targetResourceType ? { targetResourceType } : {}),
  ...(targetResourceId ? { targetResourceId } : {}),
  ...(from ? { from: dayStartInstant(from) } : {}),
  ...(to ? { to: dayEndExclusiveInstant(to) } : {}),
});

/**
 * UC50 (Organizer: the own Organization) and UC51 (Admin: the platform and every Organization). The gateway adds who the caller is;
 * audit-service decides what the caller may see, so the screen sends no Organization.
 */
export const fetchAuditLogsAPI = (query: IAuditLogQuery, signal?: AbortSignal) =>
  axios.get<IBackendRes<IAuditLogPage>>("/api/v1/audit/logs", { params: buildAuditParams(query), signal });
