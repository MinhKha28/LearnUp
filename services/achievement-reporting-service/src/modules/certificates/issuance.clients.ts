import { Logger } from '@nestjs/common';
import { isUUID } from 'class-validator';
import { object } from './completion-event';
import {
  isValidTimezone,
  IssuanceError,
  type IssuanceConfig,
} from './issuance.config';
export interface CertificateProfile {
  timezone: string;
  organizationId: string;
  name: string;
  logo: null | {
    url: string;
    expiresAt: string | null;
    mimeType: string | null;
    sizeBytes: number | null;
  };
}
export interface CourseSnapshot {
  courseId: string;
  name: string;
  versionNumber: number;
  chainId: string;
}
export interface IssuanceDirectory {
  learnerName(org: string, learner: string): Promise<string>;
  profile(org: string): Promise<CertificateProfile>;
  course(org: string, course: string): Promise<CourseSnapshot>;
}
export const ISSUANCE_DIRECTORY = Symbol('ISSUANCE_DIRECTORY');
export function snapshotName(value: unknown, max: number): string {
  if (typeof value !== 'string')
    throw new IssuanceError('INVALID_DIRECTORY_RESPONSE');
  const name = value.normalize('NFC').trim();
  if (!name || [...name].length > max)
    throw new IssuanceError('INVALID_DIRECTORY_RESPONSE');
  return name;
}
async function boundedBody(response: Response, max: number): Promise<Buffer> {
  if (!response.body) throw new IssuanceError('EMPTY_HTTP_BODY');
  const reader = response.body.getReader();
  try {
    if (Number(response.headers.get('content-length')) > max)
      throw new IssuanceError('HTTP_BODY_TOO_LARGE');
    const chunks: Buffer[] = [];
    let length = 0;
    while (true) {
      const part = await reader.read();
      if (part.done) break;
      length += part.value.length;
      if (length > max) throw new IssuanceError('HTTP_BODY_TOO_LARGE');
      chunks.push(Buffer.from(part.value));
    }
    return Buffer.concat(chunks, length);
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
export class HttpIssuanceDirectory implements IssuanceDirectory {
  private readonly logger = new Logger(HttpIssuanceDirectory.name);
  constructor(private readonly config: IssuanceConfig) {}
  private async request(
    base: string,
    path: string,
    org: string,
    body?: unknown,
  ): Promise<unknown> {
    if (!this.config.internalKey)
      throw new IssuanceError('INTERNAL_KEY_UNCONFIGURED');
    try {
      const response = await fetch(base.replace(/\/$/, '') + '/api/v1' + path, {
        method: body === undefined ? 'GET' : 'POST',
        redirect: 'error',
        signal: AbortSignal.timeout(this.config.timeoutMs),
        headers: {
          'x-internal-key': this.config.internalKey,
          'x-organization-id': org,
          'x-service-name': 'achievement-reporting-service',
          ...(body === undefined ? {} : { 'content-type': 'application/json' }),
        },
        ...(body === undefined ? {} : { body: JSON.stringify(body) }),
      });
      if (!response.ok) {
        await response.body?.cancel();
        throw new IssuanceError(
          response.status === 404
            ? 'DIRECTORY_NOT_FOUND'
            : response.status === 401 || response.status === 403
              ? 'DIRECTORY_AUTH_CONFIGURATION'
              : 'DIRECTORY_UNAVAILABLE',
        );
      }
      const parsed: unknown = JSON.parse(
        (await boundedBody(response, 1048576)).toString(),
      );
      if (!object(parsed) || !('data' in parsed))
        throw new IssuanceError('INVALID_DIRECTORY_RESPONSE');
      return parsed.data;
    } catch (error) {
      if (error instanceof IssuanceError) throw error;
      throw new IssuanceError('DIRECTORY_UNAVAILABLE');
    }
  }
  async learnerName(org: string, learner: string): Promise<string> {
    const data = await this.request(
      this.config.tenantUrl,
      '/internal/users/lookup',
      org,
      { organizationId: org, userIds: [learner] },
    );
    if (!object(data) || !Array.isArray(data.items))
      throw new IssuanceError('INVALID_DIRECTORY_RESPONSE');
    const user: unknown = data.items.find(
      (item: unknown) => object(item) && item.userId === learner,
    );
    // Deleted accounts remain eligible for historical completion. Never key this lookup by email.
    if (!object(user)) throw new IssuanceError('LEARNER_NOT_FOUND');
    return snapshotName(user.fullName, 100);
  }
  async profile(org: string): Promise<CertificateProfile> {
    if (this.config.profileMode === 'fake')
      return {
        organizationId: org,
        timezone: this.config.fallbackTimezone,
        name: 'Synthetic Organization',
        logo: null,
      };
    const data = await this.request(
      this.config.tenantUrl,
      `/internal/organizations/${encodeURIComponent(org)}/certificate-profile`,
      org,
    );
    if (
      !object(data) ||
      typeof data.organizationId !== 'string' ||
      data.organizationId.toLowerCase() !== org.toLowerCase() ||
      !(data.logo === null || object(data.logo))
    )
      throw new IssuanceError('INVALID_DIRECTORY_RESPONSE');
    const name = snapshotName(data.name, 200),
      logo = data.logo;
    if (
      object(logo) &&
      (typeof logo.url !== 'string' ||
        !(
          logo.expiresAt === null ||
          (typeof logo.expiresAt === 'string' &&
            Number.isFinite(Date.parse(logo.expiresAt)))
        ) ||
        !(logo.mimeType === null || typeof logo.mimeType === 'string') ||
        !(
          logo.sizeBytes === null ||
          (Number.isSafeInteger(logo.sizeBytes) && Number(logo.sizeBytes) >= 0)
        ))
    )
      throw new IssuanceError('INVALID_DIRECTORY_RESPONSE');
    const timezone = isValidTimezone(data.timezone)
      ? data.timezone
      : this.config.fallbackTimezone;
    if (!isValidTimezone(data.timezone))
      this.logger.error({
        code: 'CERTIFICATE_TIMEZONE_FALLBACK',
        organizationId: org,
      });
    return {
      organizationId: org,
      timezone,
      name,
      logo: logo as CertificateProfile['logo'],
    };
  }
  async course(org: string, id: string): Promise<CourseSnapshot> {
    if (this.config.courseMode === 'fake')
      return {
        courseId: id,
        chainId: id,
        versionNumber: 1,
        name: 'Synthetic Course',
      };
    const data = await this.request(
      this.config.courseUrl,
      '/internal/courses/batch',
      org,
      { courseIds: [id] },
    );
    if (!Array.isArray(data))
      throw new IssuanceError('INVALID_DIRECTORY_RESPONSE');
    const course: unknown = data.find(
      (item: unknown) => object(item) && item.courseId === id,
    );
    if (
      !object(course) ||
      typeof course.chainId !== 'string' ||
      !isUUID(course.chainId, 'all') ||
      !Number.isSafeInteger(course.versionNumber) ||
      Number(course.versionNumber) < 1
    )
      throw new IssuanceError('INVALID_DIRECTORY_RESPONSE');
    return {
      courseId: id,
      chainId: course.chainId,
      versionNumber: Number(course.versionNumber),
      name: snapshotName(course.name, 200),
    };
  }
}
export interface LogoBytes {
  bytes: Buffer;
  mime: string;
}
export function detectLogoMime(bytes: Buffer): string {
  if (
    bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return 'image/png';
  if (
    bytes.length >= 3 &&
    bytes[0] === 255 &&
    bytes[1] === 216 &&
    bytes[2] === 255
  )
    return 'image/jpeg';
  if (
    bytes.length >= 12 &&
    bytes.toString('ascii', 0, 4) === 'RIFF' &&
    bytes.toString('ascii', 8, 12) === 'WEBP'
  )
    return 'image/webp';
  throw new IssuanceError('INVALID_LOGO_TYPE');
}
export async function downloadLogo(
  url: string,
  config: IssuanceConfig,
): Promise<LogoBytes> {
  try {
    const parsed = new URL(url);
    if (
      parsed.protocol !== 'https:' ||
      parsed.username ||
      parsed.password ||
      (parsed.port && parsed.port !== '443') ||
      !config.logoHosts.includes(parsed.hostname.toLowerCase())
    )
      throw new IssuanceError('LOGO_HOST_REJECTED');
    const response = await fetch(parsed, {
      redirect: 'error',
      signal: AbortSignal.timeout(config.timeoutMs),
    });
    if (!response.ok) {
      await response.body?.cancel();
      throw new IssuanceError(
        response.status === 404 ? 'LOGO_NOT_FOUND' : 'LOGO_UNAVAILABLE',
      );
    }
    const bytes = await boundedBody(response, config.maxLogoBytes);
    return { bytes, mime: detectLogoMime(bytes) };
  } catch (error) {
    if (error instanceof IssuanceError) throw error;
    throw new IssuanceError('LOGO_UNAVAILABLE');
  }
}
