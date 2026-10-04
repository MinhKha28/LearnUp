import type {
  StorageResourceType,
  StoredResourceType,
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
}
