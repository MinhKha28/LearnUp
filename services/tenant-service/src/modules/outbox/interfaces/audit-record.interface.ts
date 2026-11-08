/**
 * Bản ghi nhật ký gửi sang audit-service (BR-270: người thực hiện, loại hành động, đối tượng tác động,
 * thời điểm, lý do khi có). Lưu nguyên trong payload của outbox_events (eventType AuditRecorded);
 * relay chuyển thành body của POST /api/v1/audit/logs.
 */
export interface AuditRecord {
  organizationId: string | null;
  actorUserId: string;
  actorRole: string;
  actionType: string;
  targetResourceType: string;
  targetResourceId: string;
  /** Chi tiết riêng của hành động; relay ghép thêm occurredAt rồi chuyển thành chuỗi JSON. */
  details: Record<string, unknown>;
  /** Thời điểm hành động xảy ra (ISO 8601); audit-service chỉ có created_at lúc nhận. */
  occurredAt: string;
}
