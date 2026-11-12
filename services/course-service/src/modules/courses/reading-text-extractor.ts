import { createRequire } from 'node:module';
import { join } from 'node:path';
import { Worker } from 'node:worker_threads';

export interface ReadingTextResult {
  wordCount: number;
  extractionWarning: string | null;
}

export interface ReadingTextWorkerInput {
  data: Uint8Array;
}

export type ReadingTextWorkerMessage =
  { ok: true; text: string } | { ok: false; errorName: string };

export interface ReadingParseLimits {
  // Thời gian tối đa cho một lần parse, quá hạn thì terminate worker.
  timeoutMs: number;
  // Giới hạn old-generation heap của worker (MiB).
  maxOldGenerationSizeMb: number;
}

export const DEFAULT_READING_PARSE_TIMEOUT_MS = 30_000;
export const DEFAULT_READING_PARSE_MAX_OLD_GENERATION_MB = 256;

export type ReadingTextExtractionFailure =
  'UNREADABLE' | 'TIMEOUT' | 'WORKER_FAILED';

export class ReadingTextExtractionError extends Error {
  constructor(
    readonly reason: ReadingTextExtractionFailure,
    readonly detail?: string,
  ) {
    super(
      'PDF text extraction failed. Verify that the document is valid and not password-protected.',
    );
    this.name = 'ReadingTextExtractionError';
  }
}

export const resolveReadingParseLimits = (
  env: Record<string, string | undefined>,
): ReadingParseLimits => {
  const read = (name: string, fallback: number): number => {
    const value = env[name];

    if (value === undefined || value === '') return fallback;

    const parsed = Number(value);

    if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed <= 0) {
      throw new Error(`Invalid ${name}: expected a positive safe integer.`);
    }

    return parsed;
  };

  return {
    timeoutMs: read(
      'READING_PDF_PARSE_TIMEOUT_MS',
      DEFAULT_READING_PARSE_TIMEOUT_MS,
    ),
    maxOldGenerationSizeMb: read(
      'READING_PDF_PARSE_MAX_OLD_GENERATION_MB',
      DEFAULT_READING_PARSE_MAX_OLD_GENERATION_MB,
    ),
  };
};

export const countWords = (text: string): number => {
  const normalized = text
    .normalize('NFC')
    .replace(/\u00a0/g, ' ')
    .trim();

  if (!normalized) return 0;

  return normalized.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word))
    .length;
};

// Bản build chạy file .js trong dist; Jest/ts-node chạy trực tiếp source .ts.
const runsFromSource = __filename.endsWith('.ts');

export interface ReadingTextWorkerOptions {
  workerFile: string;
  execArgv?: string[];
}

export const DEFAULT_READING_TEXT_WORKER: ReadingTextWorkerOptions =
  runsFromSource
    ? {
        workerFile: join(__dirname, 'reading-text.worker.ts'),
        execArgv: ['--require', 'ts-node/register/transpile-only'],
      }
    : { workerFile: join(__dirname, 'reading-text.worker.js') };

// pdf-parse nạp native binding @napi-rs/canvas trong worker. Nếu chỉ worker
// nạp nó, lúc worker thoát thư viện native bị gỡ và cả process có thể crash
// (đo được trên Windows). Giữ một tham chiếu ở main thread để binding không bị
// gỡ khi worker kết thúc hoặc bị terminate.
let nativeCanvasLoaded = false;

const keepNativeCanvasLoaded = (): void => {
  if (nativeCanvasLoaded) return;

  const fromPdfParse = createRequire(
    createRequire(__filename).resolve('pdf-parse'),
  );

  fromPdfParse('@napi-rs/canvas');
  nativeCanvasLoaded = true;
};

const parseInWorker = (
  buffer: Buffer,
  limits: ReadingParseLimits,
  workerOptions: ReadingTextWorkerOptions,
): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    // Parser luôn nhận bản sao riêng (byteOffset 0), buffer upload giữ nguyên.
    const data = new Uint8Array(buffer);
    const input: ReadingTextWorkerInput = { data };

    let settled = false;
    let worker: Worker;

    try {
      keepNativeCanvasLoaded();

      worker = new Worker(workerOptions.workerFile, {
        workerData: input,
        transferList: [data.buffer],
        execArgv: workerOptions.execArgv,
        resourceLimits: {
          maxOldGenerationSizeMb: limits.maxOldGenerationSizeMb,
        },
      });
    } catch (error) {
      reject(
        new ReadingTextExtractionError(
          'WORKER_FAILED',
          error instanceof Error ? error.message : String(error),
        ),
      );
      return;
    }

    const finish = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      worker.removeAllListeners();
      // Không chờ terminate; lỗi terminate không đổi kết quả parse.
      worker.on('error', () => undefined);
      void worker.terminate().catch(() => undefined);
      outcome();
    };

    // Callback chỉ chạy sau khi timer đã được khởi tạo.
    const timer = setTimeout(() => {
      finish(() =>
        reject(
          new ReadingTextExtractionError(
            'TIMEOUT',
            `exceeded ${limits.timeoutMs} ms`,
          ),
        ),
      );
    }, limits.timeoutMs);

    worker.on('message', (message: ReadingTextWorkerMessage) => {
      finish(() =>
        message.ok
          ? resolve(message.text)
          : reject(
              new ReadingTextExtractionError('UNREADABLE', message.errorName),
            ),
      );
    });

    worker.on('error', (error: Error) => {
      finish(() =>
        reject(new ReadingTextExtractionError('WORKER_FAILED', error.message)),
      );
    });

    worker.on('exit', (code) => {
      finish(() =>
        reject(
          new ReadingTextExtractionError(
            'WORKER_FAILED',
            `worker exited with code ${code}`,
          ),
        ),
      );
    });
  });

export const extractReadingText = async (
  buffer: Buffer,
  limits: ReadingParseLimits = resolveReadingParseLimits({}),
  workerOptions: ReadingTextWorkerOptions = DEFAULT_READING_TEXT_WORKER,
): Promise<ReadingTextResult> => {
  // Không cho tài liệu PDF bị hỏng được coi
  // là tài liệu scan hợp lệ.
  const text = await parseInWorker(buffer, limits, workerOptions);
  const wordCount = countWords(text);

  if (wordCount === 0) {
    return {
      wordCount: 0,
      extractionWarning:
        'No readable text was extracted from this document. Estimated reading time will be 0 minutes (BR-293).',
    };
  }

  return {
    wordCount,
    extractionWarning: null,
  };
};
