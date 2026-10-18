import pdfParse from 'pdf-parse';

export interface ReadingTextResult {
  wordCount: number;
  extractionWarning: string | null;
}

export const countWords = (text: string): number => {
  const normalized = text
    .normalize('NFC')
    .replace(/\u00a0/g, ' ')
    .trim();

  if (!normalized) return 0;

  return normalized.split(/\s+/u).filter((word) => /[\p{L}\p{N}]/u.test(word))
    .length;
};

export const extractReadingText = async (
  buffer: Buffer,
): Promise<ReadingTextResult> => {
  try {
    const document = await pdfParse(buffer, {
      max: 0,
    });

    const wordCount = countWords(document.text ?? '');

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
  } catch {
    // Không cho tài liệu PDF bị hỏng được coi
    // là tài liệu scan hợp lệ.
    throw new Error(
      'PDF text extraction failed. Verify that the document is valid and not password-protected.',
    );
  }
};
