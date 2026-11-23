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
  // Số worker parse chạy đồng thời; parse dư phải chờ slot.
  maxConcurrentParses: number;
  // Số parse được chờ slot; vượt quá thì từ chối ngay (BUSY).
  maxQueuedParses: number;
}

// Mẫu hợp lệ chậm nhất đo được: 230 ms (Windows) / 202 ms (Alpine).
export const DEFAULT_READING_PARSE_TIMEOUT_MS = 30_000;
// Đo được: PDF 10 MiB chứa ảnh cần 16 MiB heap; PDF 10 MiB dày chữ (~1 triệu
// từ) cần ~108 MiB. PDF hợp lệ trên ~2,3 triệu từ vượt 256 MiB và nhận 400.
export const DEFAULT_READING_PARSE_MAX_OLD_GENERATION_MB = 256;
// Đo được: ~100 MiB trên baseline cho một PDF 10 MiB chứa ảnh (Alpine);
// course-service không đặt memory limit trong compose.
export const DEFAULT_READING_PARSE_MAX_CONCURRENCY = 2;
// Đo được: mỗi request chờ giữ buffer upload (tối đa 50 MiB).
export const DEFAULT_READING_PARSE_MAX_QUEUE = 4;

// Mức tối thiểu: heap nhỏ hơn có thể làm worker không khởi động được,
// deadline nhỏ hơn có thể ngắn hơn thời gian khởi động worker.
export const MIN_READING_PARSE_TIMEOUT_MS = 1_000;
export const MIN_READING_PARSE_MAX_OLD_GENERATION_MB = 32;
export const MIN_READING_PARSE_MAX_CONCURRENCY = 1;
export const MIN_READING_PARSE_MAX_QUEUE = 0;

// BUSY: hàng đợi đầy; ABORTED: client đã ngắt kết nối.
export type ReadingTextExtractionFailure =
  'UNREADABLE' | 'TIMEOUT' | 'WORKER_FAILED' | 'BUSY' | 'ABORTED';

export class ReadingTextExtractionError extends Error {
  constructor(
    readonly reason: ReadingTextExtractionFailure,
    // Tên lớp lỗi an toàn để log (vd. PasswordException, Deadline).
    readonly errorClass: string,
    readonly detail?: string,
  ) {
    super(
      'PDF text extraction failed. Verify that the document is valid and not password-protected.',
    );
    this.name = 'ReadingTextExtractionError';
  }
}

// Đọc biến môi trường số nguyên với giá trị mặc định và mức tối thiểu.
export const readIntegerSetting = (
  env: Record<string, string | undefined>,
  name: string,
  fallback: number,
  min: number,
): number => {
  const value = env[name];

  if (value === undefined || value === '') return fallback;

  const parsed = Number(value);

  if (!/^\d+$/.test(value) || !Number.isSafeInteger(parsed) || parsed < min) {
    throw new Error(
      `Invalid ${name}: expected a safe integer of at least ${min}.`,
    );
  }

  return parsed;
};

export const resolveReadingParseLimits = (
  env: Record<string, string | undefined>,
): ReadingParseLimits => {
  const read = (name: string, fallback: number, min: number): number =>
    readIntegerSetting(env, name, fallback, min);

  return {
    timeoutMs: read(
      'READING_PDF_PARSE_TIMEOUT_MS',
      DEFAULT_READING_PARSE_TIMEOUT_MS,
      MIN_READING_PARSE_TIMEOUT_MS,
    ),
    maxOldGenerationSizeMb: read(
      'READING_PDF_PARSE_MAX_OLD_GENERATION_MB',
      DEFAULT_READING_PARSE_MAX_OLD_GENERATION_MB,
      MIN_READING_PARSE_MAX_OLD_GENERATION_MB,
    ),
    maxConcurrentParses: read(
      'READING_PDF_PARSE_MAX_CONCURRENCY',
      DEFAULT_READING_PARSE_MAX_CONCURRENCY,
      MIN_READING_PARSE_MAX_CONCURRENCY,
    ),
    maxQueuedParses: read(
      'READING_PDF_PARSE_MAX_QUEUE',
      DEFAULT_READING_PARSE_MAX_QUEUE,
      MIN_READING_PARSE_MAX_QUEUE,
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

const busyError = () =>
  new ReadingTextExtractionError('BUSY', 'ParseQueueFull', 'parse queue full');

const abortedError = () =>
  new ReadingTextExtractionError(
    'ABORTED',
    'ClientAborted',
    'client disconnected',
  );

// Semaphore FIFO có giới hạn hàng đợi: release chuyển slot trực tiếp cho parse
// đang chờ; hàng đợi đầy thì từ chối ngay; client ngắt kết nối thì rời hàng.
class ParseSlots {
  private active = 0;
  private readonly waiting: Array<() => void> = [];

  constructor(private readonly capacity: number) {}

  acquire(maxWaiting: number, signal?: AbortSignal): Promise<void> {
    if (signal?.aborted) return Promise.reject(abortedError());

    if (this.active < this.capacity) {
      this.active += 1;
      return Promise.resolve();
    }

    if (this.waiting.length >= maxWaiting) return Promise.reject(busyError());

    return new Promise<void>((resolve, reject) => {
      const onAbort = () => {
        const index = this.waiting.indexOf(grant);

        if (index >= 0) this.waiting.splice(index, 1);
        reject(abortedError());
      };
      const grant = () => {
        signal?.removeEventListener('abort', onAbort);
        resolve();
      };

      this.waiting.push(grant);
      signal?.addEventListener('abort', onAbort, { once: true });
    });
  }

  release(): void {
    const next = this.waiting.shift();

    if (next) next();
    else this.active -= 1;
  }
}

const parseSlots = new Map<number, ParseSlots>();

const slotsFor = (capacity: number): ParseSlots => {
  let slots = parseSlots.get(capacity);

  if (!slots) {
    slots = new ParseSlots(capacity);
    parseSlots.set(capacity, slots);
  }

  return slots;
};

const parseInWorker = (
  buffer: Buffer,
  limits: ReadingParseLimits,
  workerOptions: ReadingTextWorkerOptions,
  signal?: AbortSignal,
): Promise<string> =>
  new Promise<string>((resolve, reject) => {
    if (signal?.aborted) {
      reject(abortedError());
      return;
    }

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
          'WorkerStartFailed',
          error instanceof Error ? error.message : String(error),
        ),
      );
      return;
    }

    const finish = (outcome: () => void) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      signal?.removeEventListener('abort', onAbort);
      worker.removeAllListeners();
      // Chỉ trả kết quả (và nhả slot) khi worker đã thực sự dừng, để số
      // worker sống không vượt quá giới hạn đồng thời. Lỗi terminate không
      // đổi kết quả parse.
      worker.on('error', () => undefined);
      void worker
        .terminate()
        .catch(() => undefined)
        .then(outcome);
    };

    // Callback chỉ chạy sau khi timer đã được khởi tạo.
    const timer = setTimeout(() => {
      finish(() =>
        reject(
          new ReadingTextExtractionError(
            'TIMEOUT',
            'Deadline',
            `exceeded ${limits.timeoutMs} ms`,
          ),
        ),
      );
    }, limits.timeoutMs);

    // Client ngắt kết nối: dừng worker, không chờ hết deadline.
    const onAbort = () => finish(() => reject(abortedError()));

    signal?.addEventListener('abort', onAbort, { once: true });

    worker.on('message', (message: ReadingTextWorkerMessage) => {
      finish(() =>
        message.ok
          ? resolve(message.text)
          : reject(
              new ReadingTextExtractionError(
                'UNREADABLE',
                message.errorName,
                message.errorName,
              ),
            ),
      );
    });

    worker.on('error', (error: Error) => {
      finish(() =>
        reject(
          new ReadingTextExtractionError(
            'WORKER_FAILED',
            (error as NodeJS.ErrnoException).code ?? error.name,
            error.message,
          ),
        ),
      );
    });

    worker.on('exit', (code) => {
      finish(() =>
        reject(
          new ReadingTextExtractionError(
            'WORKER_FAILED',
            'WorkerExit',
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
  signal?: AbortSignal,
): Promise<ReadingTextResult> => {
  // Không cho tài liệu PDF bị hỏng được coi
  // là tài liệu scan hợp lệ.
  // Deadline chỉ bắt đầu khi đã có slot và worker được tạo.
  // Hàng đợi đầy thì từ chối đồng bộ, trước mọi side effect của request.
  const slots = slotsFor(limits.maxConcurrentParses);
  await slots.acquire(limits.maxQueuedParses, signal);

  let text: string;

  try {
    text = await parseInWorker(buffer, limits, workerOptions, signal);
  } finally {
    slots.release();
  }

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
