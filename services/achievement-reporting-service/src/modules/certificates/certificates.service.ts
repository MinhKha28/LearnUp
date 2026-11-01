import type { CertificateListQuery } from './dto/certificate-list-query.dto';
import { Injectable } from '@nestjs/common';
import { isUUID } from 'class-validator';
import type { CurrentUser } from '@learnup/ts-common';
import {
  CertificateReadRepository,
  type CertificateText,
  type CertificateCursor,
} from './certificate-read.repository';
import { issuedDate, formattedCode } from './certificate-read.config';
import { CertificatePdfRenderer } from './certificate-pdf.renderer';
import { fail } from './signer.validation';
export interface CertificateResponse {
  recipient: string;
  organizationName: string;
  courseTitle: string;
  versionNumber: number;
  issuedAt: string;
  issuedDate: string;
  certificateCode: string;
  completedLate: boolean;
  signerName: string | null;
  signerTitle: string | null;
}
@Injectable()
export class CertificatesService {
  constructor(
    private readonly repository: CertificateReadRepository,
    private readonly renderer: CertificatePdfRenderer,
  ) {}
  authorize(user: CurrentUser) {
    if (
      !user ||
      !user.isAuthenticated ||
      !isUUID(user.userId ?? '', 'all') ||
      !isUUID(user.organizationId ?? '', 'all')
    )
      fail(401, 'INVALID_USER_CONTEXT');
    if (user.role !== 'LEARNER') fail(403, 'FORBIDDEN_ROLE');
    return {
      org: user.organizationId!.toLowerCase(),
      learner: user.userId.toLowerCase(),
    };
  }
  response(row: CertificateText): CertificateResponse {
    return {
      recipient: row.learnerName,
      organizationName: row.organizationName,
      courseTitle: row.courseName,
      versionNumber: row.versionNumber,
      issuedAt: row.issuedAt.toISOString(),
      issuedDate: issuedDate(row.issuedAt, row.organizationTimezone),
      certificateCode: formattedCode(row.certificateCode),
      completedLate: row.completedLate,
      signerName: row.signerName,
      signerTitle: row.signerTitle,
    };
  }
  async list(user: CurrentUser, query: CertificateListQuery) {
    const { org, learner } = this.authorize(user);
    if (Object.keys(query).some((k) => !['size', 'cursor'].includes(k)))
      fail(400, 'INVALID_QUERY');
    const size =
      query.size === undefined
        ? 20
        : typeof query.size === 'string' &&
            /^(?:[1-9][0-9]?|100)$/.test(query.size)
          ? Number(query.size)
          : 0;
    if (!size) fail(400, 'INVALID_PAGE_SIZE');
    let cursor: CertificateCursor | undefined;
    if (query.cursor !== undefined) {
      try {
        if (
          typeof query.cursor !== 'string' ||
          query.cursor.length > 256 ||
          !/^[A-Za-z0-9_-]+$/.test(query.cursor)
        )
          throw new Error();
        const bytes = Buffer.from(query.cursor, 'base64url');
        if (bytes.toString('base64url') !== query.cursor) throw new Error();
        const value: unknown = JSON.parse(bytes.toString('utf8'));
        if (
          !Array.isArray(value) ||
          value.length !== 2 ||
          typeof value[0] !== 'string' ||
          typeof value[1] !== 'string' ||
          !isUUID(value[1], 'all') ||
          new Date(value[0]).toISOString() !== value[0]
        )
          throw new Error();
        cursor = { issuedAt: value[0], id: value[1] };
      } catch {
        fail(400, 'INVALID_CURSOR');
      }
    }
    const rows = await this.repository.list(org, learner, size, cursor);
    const page = rows.slice(0, size),
      last = page.at(-1);
    return {
      items: page.map((row) => ({
        id: row.id,
        courseTitle: row.courseName,
        versionNumber: row.versionNumber,
        issuedAt: row.issuedAt.toISOString(),
        issuedDate: issuedDate(row.issuedAt, row.organizationTimezone),
        completedLate: row.completedLate,
      })),
      nextCursor:
        rows.length > size && last
          ? Buffer.from(
              JSON.stringify([last.issuedAt.toISOString(), last.id]),
            ).toString('base64url')
          : null,
    };
  }
  async detail(user: CurrentUser, id: string) {
    const { org, learner } = this.authorize(user);
    if (!isUUID(id, 'all')) fail(404, 'CERTIFICATE_NOT_FOUND');
    const row = await this.repository.detail(org, learner, id);
    if (!row) fail(404, 'CERTIFICATE_NOT_FOUND');
    return this.response(row);
  }
  async pdf(user: CurrentUser, id: string) {
    const { org, learner } = this.authorize(user);
    if (!isUUID(id, 'all')) fail(404, 'CERTIFICATE_NOT_FOUND');
    const row = await this.repository.pdf(org, learner, id);
    if (!row) fail(404, 'CERTIFICATE_NOT_FOUND');
    return {
      bytes: await this.renderer.render(row, this.response(row)),
      code: formattedCode(row.certificateCode),
    };
  }
}
