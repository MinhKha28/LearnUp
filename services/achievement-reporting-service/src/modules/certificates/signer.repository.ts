import { Injectable } from '@nestjs/common';
import { v7 } from 'uuid';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
import type { Prisma } from '../../../generated/prisma/client';
import type { AssetSnapshot } from './certificates.repository';
import { fail } from './signer.validation';
type Tx = Prisma.TransactionClient;
export interface SignerSetting {
  organization_id: string;
  signer_name: string;
  signer_title: string;
  signature_asset_key: string | null;
  signature_hash: string | null;
  signature_mime: string | null;
  signature_size_bytes: number | null;
  version: number;
  updated_at: Date;
}
export interface CleanupTask {
  id: string;
  asset_key: string;
  lease_token: string;
  attempts: number;
}
// Shared by settings writes and issuance, including the absent-row version 0 case.
export async function lockSigner(tx: Tx, org: string): Promise<void> {
  await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`certificate-signer:${org}`},0))`;
}
@Injectable()
export class SignerRepository {
  constructor(private readonly db: PrismaService) {}
  async get(org: string): Promise<SignerSetting | null> {
    const rows = await this.db.$queryRaw<
      SignerSetting[]
    >`SELECT * FROM certificate_signer_settings WHERE organization_id=${org}::uuid`;
    return rows[0] ?? null;
  }
  async enqueue(
    key: string,
    reason: string,
    delayMs: number,
    tx: Tx = this.db,
  ): Promise<void> {
    await tx.$executeRaw`INSERT INTO storage_cleanup_tasks(id,asset_key,reason,not_before,next_attempt_at)
   VALUES (${v7()}::uuid,${key},${reason},clock_timestamp()+${delayMs}*interval '1 millisecond',clock_timestamp()+${delayMs}*interval '1 millisecond')
   ON CONFLICT(asset_key) DO UPDATE SET not_before=GREATEST(storage_cleanup_tasks.not_before,EXCLUDED.not_before),next_attempt_at=GREATEST(storage_cleanup_tasks.next_attempt_at,EXCLUDED.next_attempt_at)`;
  }
  async put(
    org: string,
    user: string,
    version: number,
    input: { signerName: string; signerTitle: string; action: string },
    asset: AssetSnapshot | null,
    delayMs: number,
  ): Promise<SignerSetting> {
    return this.db.$transaction(async (tx) => {
      await lockSigner(tx, org);
      const current = (
        await tx.$queryRaw<
          SignerSetting[]
        >`SELECT * FROM certificate_signer_settings WHERE organization_id=${org}::uuid`
      )[0];
      if ((current?.version ?? 0) !== version) fail(412, 'VERSION_CONFLICT');
      const a = input.action === 'keep' ? current : null;
      const key =
        input.action === 'replace' ? asset?.key : a?.signature_asset_key;
      const hash = input.action === 'replace' ? asset?.hash : a?.signature_hash;
      const mime = input.action === 'replace' ? asset?.mime : a?.signature_mime;
      const size =
        input.action === 'replace' ? asset?.size : a?.signature_size_bytes;
      const rows = await tx.$queryRaw<
        SignerSetting[]
      >`INSERT INTO certificate_signer_settings(organization_id,signer_name,signer_title,signature_asset_key,signature_hash,signature_mime,signature_size_bytes,version,updated_by)
    VALUES(${org}::uuid,${input.signerName},${input.signerTitle},${key ?? null},${hash ?? null},${mime ?? null},${size ?? null},1,${user}::uuid)
    ON CONFLICT(organization_id) DO UPDATE SET signer_name=EXCLUDED.signer_name,signer_title=EXCLUDED.signer_title,
    signature_asset_key=EXCLUDED.signature_asset_key,signature_hash=EXCLUDED.signature_hash,signature_mime=EXCLUDED.signature_mime,signature_size_bytes=EXCLUDED.signature_size_bytes,
    version=certificate_signer_settings.version+1,updated_at=clock_timestamp(),updated_by=EXCLUDED.updated_by
    WHERE certificate_signer_settings.version=${version} RETURNING *`;
      if (!rows[0]) fail(412, 'VERSION_CONFLICT');
      if (current?.signature_asset_key && input.action !== 'keep')
        await this.enqueue(
          current.signature_asset_key,
          'SIGNER_REPLACED',
          delayMs,
          tx,
        );
      return rows[0];
    });
  }
  async claim(limit: number, leaseMs: number): Promise<CleanupTask[]> {
    return this.db.$queryRaw<
      CleanupTask[]
    >`WITH due AS (SELECT id FROM storage_cleanup_tasks WHERE not_before<=clock_timestamp() AND next_attempt_at<=clock_timestamp()
   AND (lease_until IS NULL OR lease_until<=clock_timestamp()) ORDER BY next_attempt_at,id LIMIT ${limit} FOR UPDATE SKIP LOCKED)
   UPDATE storage_cleanup_tasks t SET lease_token=${v7()}::uuid,lease_until=clock_timestamp()+${leaseMs}*interval '1 millisecond'
   FROM due WHERE t.id=due.id RETURNING t.id,t.asset_key,t.lease_token,t.attempts`;
  }
  async referenced(key: string): Promise<boolean> {
    const rows = await this.db.$queryRaw<
      { found: boolean }[]
    >`SELECT (EXISTS(SELECT 1 FROM certificates WHERE logo_asset_key=${key} OR signature_asset_key=${key})
   OR EXISTS(SELECT 1 FROM certificate_signer_settings WHERE signature_asset_key=${key})) AS found`;
    return rows[0].found;
  }
  async done(task: CleanupTask): Promise<void> {
    await this.db
      .$executeRaw`DELETE FROM storage_cleanup_tasks WHERE id=${task.id}::uuid AND lease_token=${task.lease_token}::uuid AND lease_until>clock_timestamp()`;
  }
  async retry(task: CleanupTask, seconds: number, code: string): Promise<void> {
    await this.db
      .$executeRaw`UPDATE storage_cleanup_tasks SET attempts=attempts+1,last_error=${code},next_attempt_at=clock_timestamp()+${seconds}*interval '1 second',lease_token=NULL,lease_until=NULL
   WHERE id=${task.id}::uuid AND lease_token=${task.lease_token}::uuid AND lease_until>clock_timestamp()`;
  }
  async backlog(): Promise<{ count: number; oldest: number }> {
    const rows = await this.db.$queryRaw<
      { count: number; oldest: number }[]
    >`SELECT count(*)::int AS count,COALESCE(extract(epoch FROM clock_timestamp()-min(not_before)),0)::float8 AS oldest FROM storage_cleanup_tasks WHERE not_before<=clock_timestamp()`;
    return rows[0];
  }
}
