import { Inject, Injectable } from '@nestjs/common';
import { ISSUANCE_CONFIG, type IssuanceConfig } from './issuance.config';
import { SIGNER_CONFIG, type SignerConfig } from './signer.config';
import { fail } from './signer.validation';
@Injectable()
export class SignerAccess {
  constructor(
    @Inject(ISSUANCE_CONFIG) private readonly issuance: IssuanceConfig,
    @Inject(SIGNER_CONFIG) private readonly config: SignerConfig,
  ) {}
  async assertWritable(org: string): Promise<void> {
    if (this.config.accessMode === 'fake') return;
    let data: Record<string, unknown>;
    try {
      if (!this.issuance.internalKey) throw new Error();
      const response = await fetch(
        this.issuance.tenantUrl.replace(/\/$/, '') +
          `/api/v1/internal/organizations/${encodeURIComponent(org)}/access`,
        {
          headers: {
            'x-internal-key': this.issuance.internalKey,
            'x-organization-id': org,
            'x-service-name': 'achievement-reporting-service',
          },
          signal: AbortSignal.timeout(this.issuance.timeoutMs),
          redirect: 'error',
        },
      );
      if (!response.ok || !response.body) {
        await response.body?.cancel();
        throw new Error();
      }
      // Bound both advertised and streamed JSON; never log a dependency response.
      const reader = response.body.getReader();
      const chunks: Buffer[] = [];
      let length = 0;
      try {
        if (Number(response.headers.get('content-length')) > 65536)
          throw new Error();
        while (true) {
          const part = await reader.read();
          if (part.done) break;
          length += part.value.length;
          if (length > 65536) throw new Error();
          chunks.push(Buffer.from(part.value));
        }
      } finally {
        await reader.cancel().catch(() => undefined);
        reader.releaseLock();
      }
      const envelope: unknown = JSON.parse(Buffer.concat(chunks).toString());
      if (
        !envelope ||
        typeof envelope !== 'object' ||
        !('data' in envelope) ||
        !envelope.data ||
        typeof envelope.data !== 'object'
      )
        throw new Error();
      data = envelope.data as Record<string, unknown>;
      if (
        data.organizationId !== org ||
        typeof data.organizationStatus !== 'string' ||
        !['Active', 'Grace', 'Suspended', 'Ended'].includes(
          String(data.subscriptionStatus),
        )
      )
        throw new Error();
    } catch {
      fail(503, 'TENANT_UNAVAILABLE');
    }
    // BR-17: a Suspended subscription gives Organizer read-only access.
    if (
      data.organizationStatus !== 'Active' ||
      ['Suspended', 'Ended'].includes(String(data.subscriptionStatus))
    )
      fail(403, 'ORGANIZATION_READ_ONLY');
  }
}
