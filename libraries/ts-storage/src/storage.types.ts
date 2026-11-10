export type StorageResourceType = "image" | "video" | "raw" | "auto";
export type StoredResourceType = Exclude<StorageResourceType, "auto">;
/** Cloudinary calls public delivery `upload`. */
export type StorageDeliveryType = "upload" | "private" | "authenticated";
