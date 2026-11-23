/**
 * UC13.6: payload v1 của event UserDeleted (outbox_events, aggregateType User).
 * Bên nhận (learner_accounts của learning-service, assessment-service) khử trùng theo eventId
 * (= id dòng outbox); xóa là trạng thái cuối, không có đường quay lại, nên nhận trùng chỉ gán lại cùng giá trị.
 */
export interface UserDeletedEvent {
  userId: string;
  organizationId: string;
  role: string;
  /** Thời điểm xóa (ISO 8601) = users.deleted_at = outbox_events.occurred_at. */
  deletedAt: string;
  /** Thời điểm phát sinh (ISO 8601), trùng outbox_events.occurred_at. */
  occurredAt: string;
}
