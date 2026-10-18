export const COURSE_STATUS = {
  DRAFT: 'Draft',
  SUBMITTED: 'Submitted',
  PUBLISHED: 'Published',
  REJECTED: 'Rejected',
  ARCHIVED: 'Archived',
  DISABLED: 'Disabled',
} as const;

export type CourseStatus = (typeof COURSE_STATUS)[keyof typeof COURSE_STATUS];

export const COURSE_TYPE = {
  PUBLIC: 'Public',
  PRIVATE: 'Private',
} as const;

export type CourseType = (typeof COURSE_TYPE)[keyof typeof COURSE_TYPE];

export const COURSE_COVER_MAX_SIZE_BYTES = 5 * 1024 * 1024;

export const COURSE_COVER_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/webp',
] as const;

/**
 * Giới hạn vận hành dành riêng cho UC17.1 sử dụng Buffer.
 * 500 MiB = 524,288,000 bytes.
 */
export const VIDEO_UPLOAD_BUFFER_MAX_BYTES = 500 * 1024 * 1024;
