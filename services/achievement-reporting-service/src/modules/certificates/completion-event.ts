import { createHash } from 'node:crypto';
import { isUUID } from 'class-validator';
import {
  validateCompletionSnapshot,
  type CompletionSnapshot,
} from './completion-snapshot';
export interface CompletionData {
  enrollmentId: string;
  organizationId: string;
  learnerId: string;
  courseId: string;
  enrollmentType: 'Required' | 'Optional';
  completedAt: string;
  dueAt: string | null;
  completedLate: boolean;
  scoreSnapshot: CompletionSnapshot;
  occurredAt: string;
}
export interface CompletionEvent {
  eventId: string;
  data: CompletionData;
}
export interface Delivery {
  topic: string;
  partition: number;
  offset: string;
  value: Buffer | null;
  key?: Buffer | null;
}
export const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const date = (v: unknown): v is string =>
  typeof v === 'string' &&
  /^\d{4}-\d\d-\d\dT.*Z$/.test(v) &&
  Number.isFinite(Date.parse(v));
export function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (object(value))
    return `{${Object.keys(value)
      .sort()
      .map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export const fingerprint = (value: unknown) =>
  createHash('sha256').update(canonical(value)).digest('hex');
function postgresJson(value: unknown, depth = 0): boolean {
  if (depth > 64 || (typeof value === 'number' && !Number.isFinite(value)))
    return false;
  if (typeof value === 'string') {
    for (let i = 0; i < value.length; i++) {
      const char = value.charCodeAt(i);
      if (char === 0 || (char >= 0xdc00 && char <= 0xdfff)) return false;
      if (char >= 0xd800 && char <= 0xdbff) {
        const low = value.charCodeAt(++i);
        if (!(low >= 0xdc00 && low <= 0xdfff)) return false;
      }
    }
  }
  if (Array.isArray(value))
    return value.every((item) => postgresJson(item, depth + 1));
  if (object(value))
    return Object.entries(value).every(
      ([key, item]) =>
        postgresJson(key, depth + 1) && postgresJson(item, depth + 1),
    );
  return true;
}
export function decodeCompletion(delivery: Delivery): {
  event?: CompletionEvent;
  ignored?: true;
  reason?: string;
  payload: unknown;
  eventId?: string;
} {
  let payload: unknown;
  try {
    payload = JSON.parse(
      delivery.value === null
        ? 'null'
        : new TextDecoder('utf-8', { fatal: true }).decode(delivery.value),
    ) as unknown;
  } catch {
    return {
      reason: 'INVALID_JSON',
      payload: { rawBase64: delivery.value?.toString('base64') ?? null },
    };
  }
  if (!postgresJson(payload))
    return {
      reason: 'UNSUPPORTED_JSON_VALUE',
      payload: { rawBase64: delivery.value?.toString('base64') ?? null },
      eventId:
        object(payload) &&
        typeof payload.eventId === 'string' &&
        postgresJson(payload.eventId)
          ? payload.eventId
          : undefined,
    };
  const bad = () => ({
    reason: 'INVALID_COMPLETION_SCHEMA',
    payload,
    eventId:
      object(payload) && typeof payload.eventId === 'string'
        ? payload.eventId
        : undefined,
  });
  if (
    !object(payload) ||
    typeof payload.eventId !== 'string' ||
    !isUUID(payload.eventId, 'all') ||
    typeof payload.eventType !== 'string' ||
    !Number.isSafeInteger(payload.version) ||
    Number(payload.version) < 1 ||
    !date(payload.occurredAt) ||
    typeof payload.organizationId !== 'string' ||
    !isUUID(payload.organizationId, 'all') ||
    payload.producer !== 'learning-service' ||
    !object(payload.data) ||
    !Object.keys(payload).every((key) =>
      [
        'eventId',
        'eventType',
        'version',
        'occurredAt',
        'organizationId',
        'producer',
        'data',
      ].includes(key),
    )
  )
    return bad();
  if (payload.eventType !== 'EnrollmentCompleted')
    return { ignored: true, payload };
  const d = payload.data;
  if (
    payload.version !== 1 ||
    !Object.keys(d).every((key) =>
      [
        'enrollmentId',
        'organizationId',
        'learnerId',
        'courseId',
        'enrollmentType',
        'completedAt',
        'dueAt',
        'completedLate',
        'scoreSnapshot',
        'occurredAt',
      ].includes(key),
    ) ||
    ['enrollmentId', 'organizationId', 'learnerId', 'courseId'].some(
      (key) => typeof d[key] !== 'string' || !isUUID(d[key], 'all'),
    ) ||
    d.organizationId !== payload.organizationId ||
    !date(d.completedAt) ||
    d.occurredAt !== d.completedAt ||
    payload.occurredAt !== d.completedAt ||
    !['Required', 'Optional'].includes(String(d.enrollmentType)) ||
    typeof d.completedLate !== 'boolean' ||
    !(d.dueAt === null || date(d.dueAt)) ||
    (d.enrollmentType === 'Required' && d.dueAt === null) ||
    (d.enrollmentType === 'Optional' &&
      (d.dueAt !== null || d.completedLate !== false)) ||
    (delivery.key && delivery.key.toString() !== d.enrollmentId)
  )
    return bad();
  try {
    validateCompletionSnapshot(
      d.scoreSnapshot,
      d.organizationId,
      d.learnerId as string,
      d.courseId as string,
    );
  } catch {
    return bad();
  }
  return {
    event: { eventId: payload.eventId, data: d as unknown as CompletionData },
    payload,
  };
}
