import { describe, expect, it, jest } from '@jest/globals';
import { randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { Readable } from 'node:stream';
import { memoryStorage } from 'multer';
import {
  DEFAULT_READING_PARSE_MAX_OLD_GENERATION_MB,
  DEFAULT_READING_PARSE_TIMEOUT_MS,
  DEFAULT_READING_TEXT_WORKER,
  ReadingTextExtractionError,
  extractReadingText,
  resolveReadingParseLimits,
} from './reading-text-extractor';

jest.setTimeout(60_000);

const fixtures = join(__dirname, '../../../test/fixtures/reading-pdf');
const workers = join(fixtures, 'workers');
const fixture = (name: string) => readFileSync(join(fixtures, `${name}.pdf`));
const limits = resolveReadingParseLimits({});
const BR_293_WARNING =
  'No readable text was extracted from this document. Estimated reading time will be 0 minutes (BR-293).';

// Buffer nằm giữa một backing store lớn hơn (byteOffset khác 0), giống pool 8 KiB của Node.
const offsetCopy = (bytes: Buffer, offset = 37): Buffer => {
  const backing = Buffer.alloc(bytes.length + offset + 64, 0x20);
  bytes.copy(backing, offset);
  return backing.subarray(offset, offset + bytes.length);
};

// Đi qua Multer memory storage thật như request upload.
const multerUpload = (bytes: Buffer): Promise<Buffer> =>
  new Promise((resolve, reject) => {
    const stream = Readable.from([bytes.subarray(0, 100), bytes.subarray(100)]);
    const storage = memoryStorage() as unknown as {
      _handleFile: (
        req: unknown,
        file: { stream: Readable },
        cb: (error: Error | null, info: { buffer: Buffer }) => void,
      ) => void;
    };

    storage._handleFile({}, { stream }, (error, info) =>
      error ? reject(error) : resolve(info.buffer),
    );
  });

// PDF classic xref nhiều trang + một stream đệm lớn, sinh trong test.
const buildLargePdf = (pages: number, fillerBytes: number): Buffer => {
  const parts: Buffer[] = [];
  const offsets: number[] = [];
  let length = 0;
  const push = (chunk: Buffer | string) => {
    const buffer = typeof chunk === 'string' ? Buffer.from(chunk) : chunk;
    parts.push(buffer);
    length += buffer.length;
  };
  const object = (id: number, body: Buffer | string) => {
    offsets[id] = length;
    push(`${id} 0 obj\n`);
    push(body);
    push('\nendobj\n');
  };

  const firstPage = 4;
  const fillerId = firstPage + pages * 2;
  const kids = Array.from(
    { length: pages },
    (_, index) => `${firstPage + index * 2} 0 R`,
  ).join(' ');

  push('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n');
  object(1, '<< /Type /Catalog /Pages 2 0 R >>');
  object(2, `<< /Type /Pages /Kids [${kids}] /Count ${pages} >>`);
  object(3, '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>');

  for (let index = 0; index < pages; index += 1) {
    const pageId = firstPage + index * 2;
    const content = `BT /F1 12 Tf 72 720 Td (Reading page number ${index + 1}) Tj ET`;

    object(
      pageId,
      `<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents ${pageId + 1} 0 R >>`,
    );
    object(
      pageId + 1,
      `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    );
  }

  const filler = randomBytes(fillerBytes);
  object(
    fillerId,
    Buffer.concat([
      Buffer.from(`<< /Length ${filler.length} >>\nstream\n`),
      filler,
      Buffer.from('\nendstream'),
    ]),
  );

  const xrefOffset = length;
  push(`xref\n0 ${fillerId + 1}\n0000000000 65535 f \n`);

  for (let id = 1; id <= fillerId; id += 1) {
    push(`${String(offsets[id]).padStart(10, '0')} 00000 n \n`);
  }

  push(
    `trailer\n<< /Size ${fillerId + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`,
  );

  return Buffer.concat(parts);
};

const expectFailure = async (
  promise: Promise<unknown>,
  reason: ReadingTextExtractionError['reason'],
) => {
  const error = await promise.then(
    () => {
      throw new Error('Expected the extraction to fail.');
    },
    (failure: unknown) => failure,
  );

  expect(error).toBeInstanceOf(ReadingTextExtractionError);
  expect((error as ReadingTextExtractionError).reason).toBe(reason);

  return error as ReadingTextExtractionError;
};

describe('extractReadingText with pdf-parse 2', () => {
  it.each([
    ['chromium', 5],
    ['word', 6],
    ['xref-stream', 4],
    ['vietnamese', 9],
    ['small-classic-xref', 4],
  ])('counts the words of the %s fixture', async (name, words) => {
    await expect(extractReadingText(fixture(name), limits)).resolves.toEqual({
      wordCount: words,
      extractionWarning: null,
    });
  });

  it('returns the BR-293 warning for an image-only PDF without counting page labels', async () => {
    await expect(
      extractReadingText(fixture('image-only'), limits),
    ).resolves.toEqual({ wordCount: 0, extractionWarning: BR_293_WARNING });
  });

  it.each([
    ['corrupt', 'InvalidPDFException'],
    ['password-protected', 'PasswordException'],
  ])('rejects the %s fixture as unreadable', async (name, detail) => {
    const error = await expectFailure(
      extractReadingText(fixture(name), limits),
      'UNREADABLE',
    );

    expect(error.detail).toBe(detail);
  });

  it('parses a Buffer that sits at a nonzero byteOffset of a larger backing store', async () => {
    for (const name of ['xref-stream', 'small-classic-xref', 'vietnamese']) {
      const bytes = fixture(name);
      const upload = offsetCopy(bytes);

      expect(upload.byteOffset).toBe(37);
      expect(upload.buffer.byteLength).toBeGreaterThan(upload.length);

      const result = await extractReadingText(upload, limits);

      expect(result.wordCount).toBe(
        { 'xref-stream': 4, 'small-classic-xref': 4, vietnamese: 9 }[name],
      );
      // Buffer upload gốc giữ nguyên byte và không bị detach.
      expect(upload.byteLength).toBe(bytes.length);
      expect(Buffer.compare(upload, bytes)).toBe(0);
    }
  });

  it('parses the pooled Buffer that Multer memory storage produces', async () => {
    const bytes = fixture('xref-stream');
    const upload = await multerUpload(bytes);

    expect(upload.buffer.byteLength).toBeGreaterThan(upload.length);
    await expect(extractReadingText(upload, limits)).resolves.toEqual({
      wordCount: 4,
      extractionWarning: null,
    });
    expect(Buffer.compare(upload, bytes)).toBe(0);
  });

  it('parses a generated 10 MiB, 12-page PDF', async () => {
    const bytes = buildLargePdf(12, 10 * 1024 * 1024);
    const before = Buffer.from(bytes);

    expect(bytes.length).toBeGreaterThan(10 * 1024 * 1024);
    await expect(extractReadingText(bytes, limits)).resolves.toEqual({
      wordCount: 48,
      extractionWarning: null,
    });
    expect(bytes.equals(before)).toBe(true);
  });

  it('stops a real parse that exceeds the deadline', async () => {
    const bytes = buildLargePdf(12, 10 * 1024 * 1024);

    await expectFailure(
      extractReadingText(bytes, { ...limits, timeoutMs: 1 }),
      'TIMEOUT',
    );
  });

  it('terminates a hanging worker at the deadline', async () => {
    const started = Date.now();
    const error = await expectFailure(
      extractReadingText(
        fixture('chromium'),
        { ...limits, timeoutMs: 300 },
        { workerFile: join(workers, 'hang.js') },
      ),
      'TIMEOUT',
    );

    expect(error.detail).toBe('exceeded 300 ms');
    expect(Date.now() - started).toBeLessThan(10_000);
  });

  it.each([
    ['crash.js', 'reading worker crashed'],
    ['exit-silently.js', 'worker exited with code 3'],
  ])('rejects when the worker fails (%s)', async (file, detail) => {
    const error = await expectFailure(
      extractReadingText(fixture('chromium'), limits, {
        workerFile: join(workers, file),
      }),
      'WORKER_FAILED',
    );

    expect(error.detail).toBe(detail);
  });

  it('rejects when the worker reaches its heap limit', async () => {
    const error = await expectFailure(
      extractReadingText(
        fixture('chromium'),
        { ...limits, maxOldGenerationSizeMb: 32 },
        { workerFile: join(workers, 'out-of-memory.js') },
      ),
      'WORKER_FAILED',
    );

    expect(error.detail).toMatch(/memory limit/);
  });

  it('rejects when the worker file cannot be loaded', async () => {
    await expectFailure(
      extractReadingText(fixture('chromium'), limits, {
        workerFile: join(workers, 'missing.js'),
      }),
      'WORKER_FAILED',
    );
  });

  it('runs the TypeScript worker source under Jest', () => {
    expect(DEFAULT_READING_TEXT_WORKER.workerFile).toMatch(
      /reading-text\.worker\.ts$/,
    );
  });
});

describe('resolveReadingParseLimits', () => {
  it('uses the defaults when the variables are unset or empty', () => {
    const expected = {
      timeoutMs: DEFAULT_READING_PARSE_TIMEOUT_MS,
      maxOldGenerationSizeMb: DEFAULT_READING_PARSE_MAX_OLD_GENERATION_MB,
    };

    expect(resolveReadingParseLimits({})).toEqual(expected);
    expect(
      resolveReadingParseLimits({
        READING_PDF_PARSE_TIMEOUT_MS: '',
        READING_PDF_PARSE_MAX_OLD_GENERATION_MB: '',
      }),
    ).toEqual(expected);
  });

  it('reads positive integer overrides', () => {
    expect(
      resolveReadingParseLimits({
        READING_PDF_PARSE_TIMEOUT_MS: '5000',
        READING_PDF_PARSE_MAX_OLD_GENERATION_MB: '128',
      }),
    ).toEqual({ timeoutMs: 5000, maxOldGenerationSizeMb: 128 });
  });

  it.each(['0', '-1', '1.5', 'abc', '9007199254740993'])(
    'rejects the invalid value %s',
    (value) => {
      expect(() =>
        resolveReadingParseLimits({ READING_PDF_PARSE_TIMEOUT_MS: value }),
      ).toThrow('Invalid READING_PDF_PARSE_TIMEOUT_MS');
      expect(() =>
        resolveReadingParseLimits({
          READING_PDF_PARSE_MAX_OLD_GENERATION_MB: value,
        }),
      ).toThrow('Invalid READING_PDF_PARSE_MAX_OLD_GENERATION_MB');
    },
  );
});
