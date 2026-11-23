import { parentPort, workerData } from 'node:worker_threads';
import { PDFParse } from 'pdf-parse';
import type {
  ReadingTextWorkerInput,
  ReadingTextWorkerMessage,
} from './reading-text-extractor';

const parse = async (data: Uint8Array): Promise<string> => {
  // CVE-2024-4367: không cho PDF.js biên dịch font bằng eval.
  const parser = new PDFParse({ data, isEvalSupported: false });

  try {
    // Không chèn nhãn trang vào text, tránh đếm sai PDF scan.
    const result = await parser.getText({ pageJoiner: '' });

    return result.text ?? '';
  } finally {
    await parser.destroy();
  }
};

const run = async (): Promise<void> => {
  const { data } = workerData as ReadingTextWorkerInput;
  let message: ReadingTextWorkerMessage;

  try {
    message = { ok: true, text: await parse(data) };
  } catch (error) {
    message = {
      ok: false,
      errorName: error instanceof Error ? error.name : typeof error,
    };
  }

  parentPort?.postMessage(message);
};

void run();
