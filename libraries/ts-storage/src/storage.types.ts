export type StorageResourceType = "image" | "video" | "raw" | "auto";
export type StoredResourceType = Exclude<StorageResourceType, "auto">;
