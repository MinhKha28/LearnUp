// BR-320: one prompt file per Assignment, same limits as a submission file. The team has not fixed a number yet,
// so this takes the Reading limit of BR-268 (PDF, 50 MB).
export const PROMPT_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const PROMPT_FILE_MIME_TYPES = ['application/pdf'] as const;
export const PDF_MIME = PROMPT_FILE_MIME_TYPES[0];

export const promptFileFolder = (organizationId: string) =>
  `learnup/${organizationId}/assignments/prompts`;
