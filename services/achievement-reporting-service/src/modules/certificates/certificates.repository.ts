import { lockSigner } from './signer.repository';
import { Injectable } from '@nestjs/common';
import { v7 } from 'uuid';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import { certificateCode } from './certificate-code';
import {
  fingerprint,
  type CompletionEvent,
  type Delivery,
} from './completion-event';
type Tx = Prisma.TransactionClient;
export interface PendingCertificate {
  id: string;
  organization_id: string;
  learner_id: string;
  course_id: string;
  issue_attempts: number;
  lease_token: string;
  lease_until: Date;
}
export interface AssetSnapshot {
  key: string;
  hash: string;
  mime: string;
  size: number;
}
export interface IssuanceSnapshot {
  organizationTimezone: string;
  learnerName: string;
  organizationName: string;
  courseName: string;
  versionNumber: number;
  chainId: string;
  logo: AssetSnapshot | null;
  signer?: {
    version: number;
    name: string | null;
    title: string | null;
    asset: AssetSnapshot | null;
  };
}
@Injectable()
export class CertificatesRepository {
  constructor(private readonly db: PrismaService) {}
  async quarantine(
    tx: Tx,
    delivery: Delivery,
    payload: unknown,
    reason: string,
    eventId?: string,
  ): Promise<void> {
    await tx.$executeRaw`INSERT INTO completion_event_quarantine(id,topic,"partition","offset",event_id,reason,payload)
      VALUES (${v7()}::uuid,${delivery.topic},${delivery.partition},${BigInt(delivery.offset)},${eventId ?? null},${reason},${JSON.stringify(payload)}::jsonb)
      ON CONFLICT(topic,"partition","offset") DO NOTHING`;
  }
  quarantineInvalid(
    delivery: Delivery,
    payload: unknown,
    reason: string,
    eventId?: string,
  ): Promise<void> {
    return this.db.$transaction((tx) =>
      this.quarantine(tx, delivery, payload, reason, eventId),
    );
  }
  async receive(
    event: CompletionEvent,
    delivery: Delivery,
    payload: unknown,
    generateCode = certificateCode,
  ): Promise<{ id?: string; conflict?: string }> {
    const d = event.data,
      hash = fingerprint(d);
    return this.db.$transaction(async (tx) => {
      // Consistent lock order also serializes receipt IDs shared by different enrollments.
      for (const key of [
        `event:${event.eventId}`,
        `enrollment:${d.enrollmentId}`,
        `learner-course:${d.learnerId}:${d.courseId}`,
      ].sort()) {
        await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${key},0))`;
      }
      const receipts = await tx.$queryRaw<
        { certificate_id: string; fingerprint: string }[]
      >`SELECT certificate_id,fingerprint FROM processed_completion_events WHERE event_id=${event.eventId}::uuid`;
      if (receipts[0]) {
        if (receipts[0].fingerprint === hash)
          return { id: receipts[0].certificate_id };
        await this.quarantine(
          tx,
          delivery,
          payload,
          'EVENT_ID_CONFLICT',
          event.eventId,
        );
        return { conflict: 'EVENT_ID_CONFLICT' };
      }
      const existing = await tx.$queryRaw<
        { id: string; completion_fingerprint: string }[]
      >`SELECT id,completion_fingerprint FROM certificates
        WHERE enrollment_id=${d.enrollmentId}::uuid OR (learner_id=${d.learnerId}::uuid AND course_id=${d.courseId}::uuid)`;
      let id = existing[0]?.id;
      if (existing[0] && existing[0].completion_fingerprint !== hash) {
        await this.quarantine(
          tx,
          delivery,
          payload,
          'COMPLETION_CONFLICT',
          event.eventId,
        );
        return { conflict: 'COMPLETION_CONFLICT' };
      }
      if (!id) {
        for (let attempt = 0; attempt < 3; attempt++) {
          const rows = await tx.$queryRaw<
            { id: string }[]
          >`INSERT INTO certificates(id,organization_id,enrollment_id,learner_id,course_id,certificate_code,status,issued_at,completed_late,score_snapshot,completion_fingerprint,next_attempt_at,updated_at)
            VALUES (${v7()}::uuid,${d.organizationId}::uuid,${d.enrollmentId}::uuid,${d.learnerId}::uuid,${d.courseId}::uuid,${generateCode()},'Pending',${new Date(d.completedAt)},${d.completedLate},${JSON.stringify(d.scoreSnapshot)}::jsonb,${hash},clock_timestamp(),clock_timestamp())
            ON CONFLICT(certificate_code) DO NOTHING RETURNING id`;
          if (rows[0]) {
            id = rows[0].id;
            break;
          }
        }
        if (!id) throw new Error('CERTIFICATE_CODE_COLLISION_LIMIT');
      }
      await tx.$executeRaw`INSERT INTO processed_completion_events(event_id,certificate_id,fingerprint) VALUES (${event.eventId}::uuid,${id}::uuid,${hash})`;
      return { id };
    });
  }
  /** Worker-only cross-organization scan; all issuance updates are fenced by its lease token. */
  claimDueAcrossOrganizations(
    limit: number,
    leaseMs: number,
  ): Promise<PendingCertificate[]> {
    const token = v7();
    return this.db
      .$queryRaw`WITH due AS (SELECT id FROM certificates WHERE status='Pending' AND next_attempt_at<=clock_timestamp()
      AND (lease_until IS NULL OR lease_until<=clock_timestamp()) ORDER BY next_attempt_at,id LIMIT ${limit} FOR UPDATE SKIP LOCKED)
      UPDATE certificates c SET lease_token=${token}::uuid,lease_until=clock_timestamp()+${leaseMs}*interval '1 millisecond',updated_at=clock_timestamp()
      FROM due WHERE c.id=due.id RETURNING c.id,c.organization_id,c.learner_id,c.course_id,c.issue_attempts,c.lease_token,c.lease_until`;
  }
  async issue(
    row: PendingCertificate,
    snapshot: IssuanceSnapshot,
  ): Promise<boolean | 'version_changed'> {
    const a = snapshot.logo,
      signer = snapshot.signer,
      signature = signer?.asset;
    return this.db.$transaction(async (tx) => {
      await lockSigner(tx, row.organization_id);
      const lease = await tx.$queryRaw<
        { valid: boolean }[]
      >`SELECT EXISTS(SELECT 1 FROM certificates WHERE id=${row.id}::uuid AND organization_id=${row.organization_id}::uuid AND status='Pending' AND lease_token=${row.lease_token}::uuid AND lease_until>clock_timestamp()) AS valid`;
      if (!lease[0].valid) return false;
      const current = await tx.$queryRaw<
        { version: number }[]
      >`SELECT version FROM certificate_signer_settings WHERE organization_id=${row.organization_id}::uuid`;
      if ((current[0]?.version ?? 0) !== (signer?.version ?? 0))
        return 'version_changed';
      const count =
        await tx.$executeRaw`UPDATE certificates SET status='Issued',organization_timezone=${snapshot.organizationTimezone},learner_name=${snapshot.learnerName},organization_name=${snapshot.organizationName},course_name=${snapshot.courseName},
        version_number=${snapshot.versionNumber},chain_id=${snapshot.chainId}::uuid,logo_asset_key=${a?.key ?? null},logo_hash=${a?.hash ?? null},logo_mime=${a?.mime ?? null},logo_size=${a?.size ?? null},
        signer_name=${signer?.name ?? null},signer_title=${signer?.title ?? null},signature_asset_key=${signature?.key ?? null},signature_hash=${signature?.hash ?? null},signature_mime=${signature?.mime ?? null},
        issued_recorded_at=clock_timestamp(),next_attempt_at=NULL,last_error=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp()
        WHERE id=${row.id}::uuid AND organization_id=${row.organization_id}::uuid AND status='Pending' AND lease_token=${row.lease_token}::uuid AND lease_until>clock_timestamp()
        AND COALESCE((SELECT version FROM certificate_signer_settings WHERE organization_id=${row.organization_id}::uuid),0)=${signer?.version ?? 0}`;
      return count === 1;
    });
  }
  async retryVersionChange(row: PendingCertificate): Promise<void> {
    await this.db
      .$executeRaw`UPDATE certificates SET next_attempt_at=clock_timestamp(),last_error=NULL,lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp()
      WHERE id=${row.id}::uuid AND organization_id=${row.organization_id}::uuid AND status='Pending' AND lease_token=${row.lease_token}::uuid AND lease_until>clock_timestamp()`;
  }
  async retry(
    row: PendingCertificate,
    code: string,
    seconds: number,
  ): Promise<void> {
    await this.db
      .$executeRaw`UPDATE certificates SET issue_attempts=issue_attempts+1,next_attempt_at=clock_timestamp()+${seconds}*interval '1 second',last_error=${code},
      lease_token=NULL,lease_until=NULL,updated_at=clock_timestamp() WHERE id=${row.id}::uuid AND organization_id=${row.organization_id}::uuid AND status='Pending' AND lease_token=${row.lease_token}::uuid`;
  }
  async assetIsReferenced(
    row: PendingCertificate,
    key: string,
  ): Promise<boolean> {
    const rows = await this.db.$queryRaw<
      { found: boolean }[]
    >`SELECT EXISTS(SELECT 1 FROM certificates WHERE id=${row.id}::uuid AND organization_id=${row.organization_id}::uuid AND (logo_asset_key=${key} OR signature_asset_key=${key})) AS found`;
    return rows[0].found;
  }
  async metricsAcrossOrganizations(): Promise<{
    backlog: number;
    oldestPendingSeconds: number;
    issued: number;
    p50: number | null;
    p95: number | null;
    p99: number | null;
  }> {
    const rows = await this.db.$queryRaw<
      {
        backlog: number;
        oldest: number | null;
        issued: number;
        percentiles: number[] | null;
      }[]
    >`SELECT
      count(*) FILTER(WHERE status='Pending')::int AS backlog,
      extract(epoch FROM clock_timestamp()-min(created_at) FILTER(WHERE status='Pending'))::float8 AS oldest,
      count(*) FILTER(WHERE status='Issued')::int AS issued,
      percentile_cont(ARRAY[0.5,0.95,0.99]) WITHIN GROUP(ORDER BY extract(epoch FROM issued_recorded_at-issued_at)*1000) FILTER(WHERE status='Issued') AS percentiles FROM certificates`;
    const r = rows[0];
    return {
      backlog: r.backlog,
      oldestPendingSeconds: r.oldest ?? 0,
      issued: r.issued,
      p50: r.percentiles?.[0] ?? null,
      p95: r.percentiles?.[1] ?? null,
      p99: r.percentiles?.[2] ?? null,
    };
  }
}
