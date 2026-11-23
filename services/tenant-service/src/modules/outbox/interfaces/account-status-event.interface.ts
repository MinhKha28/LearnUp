/**
 * UC13.5: payload v1 của event UserDeactivated / UserReactivated (outbox_events, aggregateType User).
 * Bên nhận (bản sao thưa learner_accounts của assessment-service, learning-service) khử trùng theo
 * eventId (= id dòng outbox) và chỉ áp khi occurredAt mới hơn status_as_of đã lưu (BR-49, BR-48).
 */
export interface AccountStatusEvent {
  userId: string;
  organizationId: string;
  role: string;
  /** Trạng thái sau thao tác: Deactivated (UserDeactivated) hoặc Active (UserReactivated). */
  status: string;
  /** Thời điểm phát sinh (ISO 8601), trùng outbox_events.occurred_at. */
  occurredAt: string;
}
