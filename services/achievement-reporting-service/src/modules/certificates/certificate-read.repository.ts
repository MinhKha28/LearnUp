import { Injectable } from '@nestjs/common';
import { Prisma } from '../../../generated/prisma/client';
import { PrismaService } from '../../infrastructure/prisma/prisma.service';
export interface CertificateSummary {
  id: string;
  courseName: string;
  versionNumber: number;
  issuedAt: Date;
  completedLate: boolean;
}
export interface CertificateText {
  id: string;
  learnerName: string;
  organizationName: string;
  courseName: string;
  versionNumber: number;
  issuedAt: Date;
  certificateCode: string;
  completedLate: boolean;
  signerName: string | null;
  signerTitle: string | null;
}
export interface CertificatePdfRecord extends CertificateText {
  logoAssetKey: string | null;
  logoHash: string | null;
  logoMime: string | null;
  signatureAssetKey: string | null;
  signatureHash: string | null;
  signatureMime: string | null;
}
export interface CertificateCursor {
  issuedAt: string;
  id: string;
}
const textColumns = Prisma.sql`id, learner_name AS "learnerName", organization_name AS "organizationName",
 course_name AS "courseName", version_number AS "versionNumber", issued_at AS "issuedAt",
 certificate_code AS "certificateCode", completed_late AS "completedLate", signer_name AS "signerName", signer_title AS "signerTitle"`;
@Injectable()
export class CertificateReadRepository {
  constructor(private readonly db: PrismaService) {}
  list(
    org: string,
    learner: string,
    size: number,
    cursor?: CertificateCursor,
  ): Promise<CertificateSummary[]> {
    const after = cursor
      ? Prisma.sql`AND (issued_at,id) < (${new Date(cursor.issuedAt)},${cursor.id}::uuid)`
      : Prisma.empty;
    return this.db
      .$queryRaw(Prisma.sql`SELECT id, course_name AS "courseName", version_number AS "versionNumber", issued_at AS "issuedAt", completed_late AS "completedLate" FROM certificates
      WHERE organization_id=${org}::uuid AND learner_id=${learner}::uuid AND status='Issued'
      ${after} ORDER BY issued_at DESC,id DESC LIMIT ${size + 1}`);
  }
  async detail(
    org: string,
    learner: string,
    id: string,
  ): Promise<CertificateText | null> {
    const rows = await this.db.$queryRaw<
      CertificateText[]
    >(Prisma.sql`SELECT ${textColumns} FROM certificates
      WHERE organization_id=${org}::uuid AND learner_id=${learner}::uuid AND status='Issued' AND id=${id}::uuid`);
    return rows[0] ?? null;
  }
  async pdf(
    org: string,
    learner: string,
    id: string,
  ): Promise<CertificatePdfRecord | null> {
    const rows = await this.db.$queryRaw<
      CertificatePdfRecord[]
    >(Prisma.sql`SELECT ${textColumns},
      logo_asset_key AS "logoAssetKey",logo_hash AS "logoHash",logo_mime AS "logoMime",
      signature_asset_key AS "signatureAssetKey",signature_hash AS "signatureHash",signature_mime AS "signatureMime"
      FROM certificates WHERE organization_id=${org}::uuid AND learner_id=${learner}::uuid AND status='Issued' AND id=${id}::uuid`);
    return rows[0] ?? null;
  }
}
