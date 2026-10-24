import type {
  StorageResourceType,
  StoredResourceType,
  StorageDeliveryType,
} from "../storage.types.js";

export interface IStorageFileInput {
  buffer: Buffer;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
}

export interface IStorageValidationRules {
  maxSizeBytes?: number;
  allowedMimeTypes?: readonly string[];
}

export interface IStorageUploadOptions {
  deliveryType?: StorageDeliveryType;
  folder: string;
  publicId?: string;
  resourceType?: StorageResourceType;
  overwrite?: boolean;
  tags?: string[];
  validation?: IStorageValidationRules;
}

export interface IStoredFile {
  storageKey: string;
  publicId: string;
  url: string;
  secureUrl: string;
  resourceType: StoredResourceType;
  originalFilename: string;
  mimeType: string;
  sizeBytes: number;
  format?: string;
  width?: number;
  height?: number;
  durationSeconds?: number;
}

export interface IStorageDeleteOptions {
  deliveryType?: StorageDeliveryType;
  resourceType: StoredResourceType;
  invalidate?: boolean;
}

export interface IStorageProvider {
  upload(
    file: IStorageFileInput,
    options: IStorageUploadOptions,
  ): Promise<IStoredFile>;
  delete(storageKey: string, options: IStorageDeleteOptions): Promise<void>;
  getUrl(storageKey: string, resourceType: StoredResourceType): string;
  getUrl(
    storageKey: string,
    resourceType: StoredResourceType,
    options: IStorageUrlOptions,
  ): string;
}

export interface IStorageUrlOptions {
  deliveryType?: StorageDeliveryType;
}

export interface IStorageSignedUrlOptions extends IStorageUrlOptions {
  resourceType: StoredResourceType;
  /** Original asset format, e.g. png. Raw keys retain their extension; raw also accepts an empty format. */
  format: string;
  /** Expiration as a future UNIX timestamp in seconds. */
  expiresAt: number;
}

export interface IStorageReadOptions extends IStorageSignedUrlOptions {
  timeoutMs: number;
  maxSizeBytes: number;
}

/** Additive capability: existing storage implementations need not implement reads. */
export interface IReadableStorageProvider extends IStorageProvider {
  getSignedUrl(storageKey: string, options: IStorageSignedUrlOptions): string;
  readBytes(storageKey: string, options: IStorageReadOptions): Promise<Buffer>;
}
