/** UC50, UC51: one entry of the audit trail, as audit-service returns it (GET /api/v1/audit/logs). */
export interface IAuditLog {
  id: string;
  /** null: an action at platform level. */
  organizationId: string | null;
  actorUserId: string | null;
  actorRole: string | null;
  actionType: string;
  targetResourceType: string | null;
  targetResourceId: string | null;
  /** A JSON text written by the service that recorded the action: the reason (when there is one) and the time of the action. */
  details: string | null;
  createdAt: string;
}

/** PageResponse of java-common: `page` starts at 0. */
export interface IAuditLogPage {
  items: IAuditLog[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
  first: boolean;
  last: boolean;
}

/** What the screen filters on. Dates are yyyy-MM-dd (Vietnam time); `to` is the last day included. */
export interface IAuditLogFilter {
  targetResourceType?: string;
  targetResourceId?: string;
  from?: string;
  to?: string;
}

export interface IAuditLogQuery extends IAuditLogFilter {
  /** Starts at 1, like every other list of the frontend. */
  page: number;
  pageSize?: number;
}
