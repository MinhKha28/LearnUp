export class StorageError extends Error {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageError";
  }
}

export class StorageValidationError extends StorageError {
  constructor(message: string, options?: ErrorOptions) {
    super(message, options);
    this.name = "StorageValidationError";
  }
}

export type StorageProviderErrorCode =
  "NOT_FOUND" | "TIMEOUT" | "TOO_LARGE" | "UNAVAILABLE";

export class StorageProviderError extends StorageError {
  constructor(
    message: string,
    public readonly code: StorageProviderErrorCode = "UNAVAILABLE",
  ) {
    super(message);
    this.name = "StorageProviderError";
  }
}
