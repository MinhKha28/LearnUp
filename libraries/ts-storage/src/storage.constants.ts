export const STORAGE_MIME_TYPES = {
  IMAGE: ["image/jpeg", "image/png", "image/webp"],
  VIDEO: ["video/mp4"],
  PDF: ["application/pdf"],
} as const;

export const STORAGE_RESOURCE_TYPES = {
  IMAGE: "image",
  VIDEO: "video",
  RAW: "raw",
  AUTO: "auto",
} as const;
