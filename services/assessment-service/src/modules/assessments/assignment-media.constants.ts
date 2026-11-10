import { SUBMISSION_FILE_TYPES } from '../learner-submissions/learner-submissions.constants';

// BR-320: one prompt file per Assignment, same types and ceiling as a submission file (PDF, DOCX or ZIP, 50 MB).
// The limit actually applied is the lower of this ceiling and the raw upload limit of the storage plan.
export const PROMPT_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const PROMPT_FILE_MIME_TYPES: readonly string[] = Object.values(
  SUBMISSION_FILE_TYPES,
).map((type) => type.mimeType);
export const PDF_MIME = 'application/pdf';

export const promptFileFolder = (organizationId: string) =>
  `learnup/${organizationId}/assignments/prompts`;
