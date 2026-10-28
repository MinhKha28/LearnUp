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
export const PDF_PAGE = { width: 841.89, height: 595.28 };
export const PDF_FRAME = {
  x: 25,
  y: 25,
  width: PDF_PAGE.width - 50,
  height: PDF_PAGE.height - 50,
};
const centered = (
  y: number,
  height: number,
  size: number,
  font: 'Regular' | 'Bold',
): TextRegion => ({
  x: 60,
  y,
  width: PDF_PAGE.width - 120,
  height,
  size,
  font,
});
export const PDF_REGIONS: Record<string, TextRegion> = {
  organization: {
    x: 150,
    y: 44,
    width: PDF_PAGE.width - 300,
    height: 64,
    size: 18,
    font: 'Bold',
  },
  heading: centered(120, 38, 25, 'Bold'),
  awarded: centered(0, 22, 13, 'Regular'),
  recipient: centered(0, 64, 25, 'Bold'),
  completed: centered(0, 24, 14, 'Regular'),
  course: centered(0, 66, 22, 'Bold'),
  version: centered(0, 20, 12, 'Regular'),
  date: centered(0, 20, 12, 'Regular'),
  late: centered(0, 20, 12, 'Regular'),
  signer: centered(0, 40, 14, 'Bold'),
  title: centered(0, 58, 13, 'Regular'),
};
const textOptions = (width: number) => ({
  width,
  align: 'center' as const,
  lineGap: 2,
  features: { ccmp: false as const },
});
function measureText(doc: PDFDocument, value: string, region: TextRegion) {
  const text = value.normalize('NFC');
  const options = textOptions(region.width);
  doc.font(region.font);
  let size = region.size;
  while (size >= 10) {
    doc.fontSize(size);
    const height = doc.heightOfString(text, options);
    if (height <= region.height) return { size, height };
    size -= 0.5;
  }
  throw new Error('CERTIFICATE_LAYOUT_OVERFLOW');
}
/** Every text write shares NFC normalization and the shaping options used for measurement. */
export function pdfText(
  doc: PDFDocument,
  value: string,
  region: TextRegion,
): void {
  const measured = measureText(doc, value, region);
  doc.font(region.font).fontSize(measured.size);
  // Disabling ccmp preserves Vietnamese dotted letters in PDFKit ToUnicode mappings.
  doc.text(
    value.normalize('NFC'),
    region.x,
    region.y,
    textOptions(region.width),
  );
}
function certificateLayout(
  doc: PDFDocument,
  fields: Record<string, string>,
  signature: boolean,
) {
  const regions = Object.fromEntries(
    Object.entries(PDF_REGIONS).map(([key, region]) => [key, { ...region }]),
  );
  const sizes = new Map<string, { size: number; height: number }>();
  const measure = (key: string) =>
    sizes.set(key, measureText(doc, fields[key], regions[key]));
  for (const key of Object.keys(regions)) if (fields[key]) measure(key);
  const flow = [
    'heading',
    'awarded',
    'recipient',
    'completed',
    'course',
    'version',
    'date',
    'late',
  ].filter((key) => fields[key]);
  const footer = ['signer', 'title'].filter((key) => fields[key]);
  const bottom = PDF_FRAME.y + PDF_FRAME.height - 24;
  let gap = 8;
  const footerHeight = () =>
    (signature ? 32 + (footer.length ? 6 : 0) : 0) +
    footer.reduce((sum, key) => sum + sizes.get(key)!.height, 0) +
    Math.max(0, footer.length - 1) * 2;
  const bodyHeight = () =>
    flow.reduce((sum, key) => sum + sizes.get(key)!.height, 0) +
    Math.max(0, flow.length - 1) * gap;
  const fits = () =>
    PDF_REGIONS.heading.y + bodyHeight() + 12 <= bottom - footerHeight();
  const flexible = ['recipient', 'course', 'signer', 'title'].filter(
    (key) => fields[key],
  );
  while (!fits()) {
    let shrunk = false;
    for (const key of flexible) {
      const measured = sizes.get(key)!;
      if (measured.size > 10) {
        regions[key].size = measured.size - 0.5;
        measure(key);
        shrunk = true;
        if (fits()) break;
      }
    }
    if (!shrunk) break;
  }
  while (!fits() && gap > 0) gap -= 1;
  if (!fits()) throw new Error('CERTIFICATE_LAYOUT_OVERFLOW');
  const organization = sizes.get('organization')!;
  regions.organization.y +=
    (regions.organization.height - organization.height) / 2;
  let y = PDF_REGIONS.heading.y;
  for (const key of flow) {
    regions[key].y = y;
    regions[key].size = sizes.get(key)!.size;
    y += sizes.get(key)!.height + gap;
  }
  const signatureY = bottom - footerHeight();
  y = signatureY + (signature ? 32 + (footer.length ? 6 : 0) : 0);
  for (const key of footer) {
    regions[key].y = y;
    regions[key].size = sizes.get(key)!.size;
    y += sizes.get(key)!.height + 2;
  }
  return { regions, signatureY };
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
          completed: 'đã hoàn thành khóa học',
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
            const layout = certificateLayout(doc, fields, Boolean(signature));
            doc
              .strokeColor('#1e293b')
              .lineWidth(2)
              .rect(PDF_FRAME.x, PDF_FRAME.y, PDF_FRAME.width, PDF_FRAME.height)
              .stroke();
            doc.fillColor('#1e293b');
            for (const [key, value] of Object.entries(fields))
              if (value) pdfText(doc, value, layout.regions[key]);
            if (logo)
              doc.image(logo, 50, 45, {
                fit: [85, 55],
                align: 'center',
                valign: 'center',
              });
            if (signature)
              doc.image(
                signature,
                (PDF_PAGE.width - 150) / 2,
                layout.signatureY,
                {
                  fit: [150, 32],
                  align: 'center',
                  valign: 'center',
                },
              );
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
