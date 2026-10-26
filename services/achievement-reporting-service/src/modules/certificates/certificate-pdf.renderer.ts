import { SIGNATURE_MAX_BYTES } from './signer.validation';
import { Inject, Injectable, Logger } from '@nestjs/common';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { performance } from 'node:perf_hooks';
import PDFDocument from 'pdfkit';
import { ISSUANCE_STORAGE, type IssuanceStorage } from './issuance.storage';
import { ISSUANCE_CONFIG, type IssuanceConfig } from './issuance.config';
import { CertificatePdfQueue } from './certificate-pdf.queue';
import { unavailable, displayDate } from './certificate-read.config';
import type { CertificatePdfRecord } from './certificate-read.repository';
import type { CertificateResponse } from './certificates.service';
export interface TextRegion {
  x: number;
  y: number;
  width: number;
  height: number;
  size: number;
  font: 'Regular' | 'Bold';
}
export const PDF_REGIONS: Record<string, TextRegion> = {
  organization: {
    x: 150,
    y: 45,
    width: 640,
    height: 55,
    size: 20,
    font: 'Bold',
  },
  heading: { x: 60, y: 115, width: 720, height: 38, size: 28, font: 'Bold' },
  awarded: { x: 60, y: 165, width: 720, height: 25, size: 14, font: 'Regular' },
  recipient: { x: 60, y: 195, width: 720, height: 70, size: 27, font: 'Bold' },
  course: { x: 60, y: 280, width: 720, height: 78, size: 23, font: 'Bold' },
  version: { x: 60, y: 365, width: 720, height: 20, size: 12, font: 'Regular' },
  date: { x: 60, y: 390, width: 720, height: 20, size: 12, font: 'Regular' },
  late: { x: 60, y: 415, width: 720, height: 22, size: 12, font: 'Regular' },
  signer: { x: 60, y: 480, width: 720, height: 38, size: 15, font: 'Bold' },
  title: { x: 60, y: 520, width: 720, height: 48, size: 14, font: 'Regular' },
};
/** All PDF text uses normalized strings and the same shaping options. */
export function pdfText(
  doc: PDFDocument,
  value: string,
  region: TextRegion,
): number {
  const text = value.normalize('NFC');
  const options = {
    width: region.width,
    align: 'center' as const,
    lineGap: 2,
    features: { ccmp: false as const },
  };
  doc.font(region.font);
  let size = region.size;
  while (size > 10) {
    doc.fontSize(size);
    if (doc.heightOfString(text, options) <= region.height) break;
    size -= 0.5;
  }
  doc.fontSize(size);
  if (doc.heightOfString(text, options) > region.height)
    throw new Error('CERTIFICATE_LAYOUT_OVERFLOW');
  // Disabling ccmp preserves Vietnamese dotted letters in PDFKit ToUnicode mappings.
  doc.text(text, region.x, region.y, options);
  return size;
}
export function unsupportedGlyphCount(
  values: string[],
  fonts: { hasGlyphForCodePoint(codePoint: number): boolean }[],
): number {
  let count = 0;
  for (const value of values)
    for (const char of value.normalize('NFC')) {
      if (
        !/\s/u.test(char) &&
        fonts.some((font) => !font.hasGlyphForCodePoint(char.codePointAt(0)!))
      )
        count++;
    }
  return count;
}
@Injectable()
export class CertificatePdfRenderer {
  private readonly logger = new Logger(CertificatePdfRenderer.name);
  private readonly fonts: Record<'Regular' | 'Bold', Buffer>;
  private readonly coverage: {
    hasGlyphForCodePoint(codePoint: number): boolean;
  }[];
  constructor(
    private readonly queue: CertificatePdfQueue,
    @Inject(ISSUANCE_STORAGE) private readonly storage: IssuanceStorage,
    @Inject(ISSUANCE_CONFIG) private readonly issuance: IssuanceConfig,
  ) {
    const load = (name: string, hash: string) => {
      let bytes: Buffer;
      try {
        bytes = readFileSync(resolve(__dirname, '../../../assets/fonts', name));
      } catch {
        throw new Error('Required certificate font missing: ' + name);
      }
      if (createHash('sha256').update(bytes).digest('hex') !== hash)
        throw new Error('Certificate font checksum mismatch: ' + name);
      return bytes;
    };
    this.fonts = {
      Regular: load(
        'NotoSans-Regular.ttf',
        '478c558ea716033cd60c03438f628dfa75694dcf6b5f6d505a2f05fd2b4f3823',
      ),
      Bold: load(
        'NotoSans-Bold.ttf',
        '1df075a380fc7cb898acf64c1f7b3b4dd780de3caa860178bf929de35817a913',
      ),
    };
    const probe = this.document();
    this.coverage = ['Regular', 'Bold'].map(
      (name) => probe.font(name)._font.font,
    );
    probe.destroy();
  }
  private document() {
    const doc = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: 0,
      info: { Title: 'Chứng chỉ hoàn thành', Author: 'LearnUP' },
    });
    for (const name of ['Regular', 'Bold'] as const)
      doc.registerFont(name, this.fonts[name]);
    return doc;
  }
  private async asset(
    id: string,
    key: string | null,
    mime: string | null,
    hash: string | null,
    maxBytes = this.issuance.maxLogoBytes,
  ): Promise<Buffer | null> {
    if (!key) return null;
    if (!['image/png', 'image/jpeg'].includes(mime ?? '')) {
      this.logger.warn({
        certificateId: id,
        code: 'CERTIFICATE_ASSET_UNSUPPORTED',
      });
      return null;
    }
    const bytes = await this.storage.read(
      key,
      mime!,
      this.issuance.timeoutMs,
      maxBytes,
    );
    if (createHash('sha256').update(bytes).digest('hex') !== hash)
      throw new Error('CERTIFICATE_ASSET_HASH_MISMATCH');
    const png = bytes
      .subarray(0, 8)
      .equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
    const jpeg =
      bytes.length >= 3 &&
      bytes[0] === 255 &&
      bytes[1] === 216 &&
      bytes[2] === 255;
    if (!png && !jpeg) {
      this.logger.warn({
        certificateId: id,
        code: 'CERTIFICATE_ASSET_UNSUPPORTED',
      });
      return null;
    }
    return bytes;
  }
  render(
    row: CertificatePdfRecord,
    text: CertificateResponse,
  ): Promise<Buffer> {
    return this.queue.run(async (waitMs) => {
      const started = performance.now();
      let result: Buffer | undefined;
      try {
        const [logo, signature] = await Promise.all([
          this.asset(row.id, row.logoAssetKey, row.logoMime, row.logoHash),
          this.asset(
            row.id,
            row.signatureAssetKey,
            row.signatureMime,
            row.signatureHash,
            SIGNATURE_MAX_BYTES,
          ),
        ]);
        const fields: Record<string, string> = {
          organization: text.organizationName,
          heading: 'Chứng chỉ hoàn thành',
          awarded: 'Chứng nhận học viên',
          recipient: text.recipient,
          course: text.courseTitle,
          version: 'Phiên bản ' + text.versionNumber,
          date:
            'Ngày cấp: ' +
            displayDate(text.issuedDate) +
            '    Mã chứng chỉ: ' +
            text.certificateCode,
          late: text.completedLate ? 'Hoàn thành sau hạn' : '',
          signer: text.signerName ?? '',
          title: text.signerTitle ?? '',
        };
        const count = unsupportedGlyphCount(
          Object.values(fields),
          this.coverage,
        );
        if (count) this.logger.warn({ certificateId: row.id, count });
        const doc = this.document();
        result = await new Promise<Buffer>((resolvePdf, reject) => {
          const chunks: Buffer[] = [];
          doc.on('data', (chunk: Buffer) => chunks.push(chunk));
          doc.on('error', reject);
          doc.on('end', () => resolvePdf(Buffer.concat(chunks)));
          try {
            doc
              .strokeColor('#1e293b')
              .lineWidth(2)
              .rect(25, 25, 792, 545)
              .stroke();
            doc.fillColor('#1e293b');
            for (const [key, value] of Object.entries(fields))
              if (value) pdfText(doc, value, PDF_REGIONS[key]);
            if (logo)
              doc.image(logo, 50, 45, {
                fit: [85, 55],
                align: 'center',
                valign: 'center',
              });
            if (signature)
              doc.image(signature, 345, 443, {
                fit: [150, 32],
                align: 'center',
                valign: 'center',
              });
            doc.end();
          } catch (error) {
            doc.destroy();
            reject(
              error instanceof Error
                ? error
                : new Error('CERTIFICATE_PDF_FAILED'),
            );
          }
        });
        return result;
      } catch (error) {
        const code =
          error instanceof Error &&
          error.message === 'CERTIFICATE_ASSET_HASH_MISMATCH'
            ? error.message
            : 'CERTIFICATE_PDF_FAILED';
        this.logger.error({ certificateId: row.id, code });
        unavailable();
      } finally {
        this.logger.log({
          certificateId: row.id,
          durationMs: Math.round(performance.now() - started),
          queueWaitMs: Math.round(waitMs),
          size: result?.length ?? 0,
        });
      }
    });
  }
}
