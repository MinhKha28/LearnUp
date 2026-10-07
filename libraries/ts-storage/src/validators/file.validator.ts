import type {
  IStorageFileInput,
  IStorageValidationRules,
} from "../interfaces/storage.interface.js";
import { StorageValidationError } from "../errors/storage.error.js";

export function validateStorageFile(
  file: IStorageFileInput,
  rules?: IStorageValidationRules,
): void {
  if (!file.buffer?.length) {
    throw new StorageValidationError("File content is empty.");
  }

  if (!file.originalFilename?.trim()) {
    throw new StorageValidationError("Original filename is required.");
  }

  if (!file.mimeType?.trim()) {
    throw new StorageValidationError("File MIME type is required.");
  }

  if (!Number.isFinite(file.sizeBytes) || file.sizeBytes <= 0) {
    throw new StorageValidationError("File size must be greater than zero.");
  }

  if (rules?.maxSizeBytes && file.sizeBytes > rules.maxSizeBytes) {
    throw new StorageValidationError(
      `File exceeds maximum allowed size of ${rules.maxSizeBytes} bytes.`,
    );
  }

  if (
    rules?.allowedMimeTypes?.length &&
    !rules.allowedMimeTypes.includes(file.mimeType)
  ) {
    throw new StorageValidationError(
      `Unsupported MIME type: ${file.mimeType}.`,
    );
  }
}
