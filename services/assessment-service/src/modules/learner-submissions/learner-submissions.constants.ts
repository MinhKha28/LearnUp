export const ASSIGNMENT_KIND = 'ASSIGNMENT';

/** Grading status of a new submission (BR-312, UC30 step 6). */
export const WAITING_FOR_CYCLE = 'WaitingForCycle';
export const NEEDS_INSTRUCTOR_GRADING = 'NeedsInstructorGrading';

/** Why the Instructor has to grade (same codes as the Instructor screens, UC32). */
export const PEER_REVIEW_DISABLED = 'PEER_REVIEW_DISABLED';

export const OPEN_CYCLE_STATUS = 'Open';

/** Submission file: one PDF, DOCX or ZIP of at most 50 MB (UC30). Not counted toward the Subscription storage (BR-288). */
export const SUBMISSION_FILE_MAX_BYTES = 50 * 1024 * 1024;
export const SUBMISSION_CONTENT_MAX_LENGTH = 20000;

export interface SubmissionFileType {
  mimeType: string;
  /** First bytes of a real file of this type. */
  signature: Buffer;
}

/** A DOCX is a ZIP package, so both start with the ZIP signature. */
export const SUBMISSION_FILE_TYPES: Record<string, SubmissionFileType> = {
  pdf: {
    mimeType: 'application/pdf',
    signature: Buffer.from('%PDF-', 'latin1'),
  },
  docx: {
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    signature: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  },
  zip: {
    mimeType: 'application/zip',
    signature: Buffer.from([0x50, 0x4b, 0x03, 0x04]),
  },
};

export const submissionFolder = (
  organizationId: string,
  assessmentId: string,
) => `learnup/${organizationId}/assignments/${assessmentId}/submissions`;

export const LEARNER_STATUS_CHANGED_EVENT = 'LearnerAssessmentStatusChanged';
