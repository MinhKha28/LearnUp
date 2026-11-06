export interface AssessmentDelivery {
  topic: string;
  partition: number;
  offset: string;
  value: Buffer | null;
  key?: Buffer | null;
}
export interface AssessmentStatusEvent {
  eventId: string;
  occurredAt: string;
  organizationId: string;
  data: {
    learnerId: string;
    courseId: string;
    status:
      | 'Submitted'
      | 'Resubmitted'
      | 'PeerReviewWaived'
      | 'PeerReviewCompleted'
      | 'PeerReviewAssigned'
      | 'PeerReviewMissed'
      | 'Finalized';
    firstActivityAt?: string | null;
  };
}
const object = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object' && !Array.isArray(value);
const uuid = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
const time = (v: unknown): v is string => {
  if (
    typeof v !== 'string' ||
    !/^(?!0000)\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:\d{2})$/.test(
      v,
    ) ||
    !Number.isFinite(Date.parse(v))
  )
    return false;
  // Date.parse normalizes impossible dates such as February 30.
  const [year, month, day] = v.slice(0, 10).split('-').map(Number);
  const leap = year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0);
  const days = [31, leap ? 29 : 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  return (
    month >= 1 &&
    month <= 12 &&
    day >= 1 &&
    day <= days[month - 1] &&
    Number(v.slice(11, 13)) < 24
  );
};
export function decodeAssessment(delivery: AssessmentDelivery): {
  payload: unknown;
  event?: AssessmentStatusEvent;
  reason?: string;
  eventId?: string;
} {
  let payload: unknown;
  try {
    payload = JSON.parse(delivery.value?.toString('utf8') ?? 'null');
  } catch {
    return {
      payload: delivery.value?.toString('base64') ?? null,
      reason: 'INVALID_JSON',
    };
  }
  const fail = (reason: string) => ({
    payload,
    reason,
    eventId:
      object(payload) && typeof payload.eventId === 'string'
        ? payload.eventId
        : undefined,
  });
  if (
    !object(payload) ||
    !uuid(payload.eventId) ||
    payload.version !== 1 ||
    payload.eventType !== 'LearnerAssessmentStatusChanged' ||
    payload.producer !== 'assessment-service' ||
    !time(payload.occurredAt) ||
    !uuid(payload.organizationId) ||
    !object(payload.data) ||
    Object.keys(payload).some(
      (k) =>
        ![
          'eventId',
          'eventType',
          'version',
          'occurredAt',
          'organizationId',
          'producer',
          'data',
        ].includes(k),
    )
  )
    return fail('INVALID_ENVELOPE');
  const d = payload.data;
  if (d.courseId === undefined || d.courseId === null || d.courseId === '')
    return fail('MISSING_COURSE_ID');
  if (
    !uuid(d.courseId) ||
    !uuid(d.learnerId) ||
    !uuid(d.assessmentId) ||
    (d.organizationId !== undefined &&
      d.organizationId !== payload.organizationId) ||
    !['QUIZ', 'ASSIGNMENT'].includes(d.kind as string) ||
    ![
      'Submitted',
      'Resubmitted',
      'PeerReviewWaived',
      'PeerReviewCompleted',
      'PeerReviewAssigned',
      'PeerReviewMissed',
      'Finalized',
    ].includes(d.status as string) ||
    (d.status === 'Finalized' && d.reason !== 'ASSIGNMENT_FINALIZED') ||
    (d.firstActivityAt != null && !time(d.firstActivityAt)) ||
    (d.revision !== undefined && typeof d.revision !== 'string') ||
    (d.reason !== undefined && typeof d.reason !== 'string')
  )
    return fail('INVALID_PAYLOAD');
  return { payload, event: payload as unknown as AssessmentStatusEvent };
}
