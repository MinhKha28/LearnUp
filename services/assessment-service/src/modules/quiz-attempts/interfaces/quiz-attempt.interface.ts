import type { ILearnerAttemptState } from '../../learner-submissions/interfaces/learner-submission.interface';

/** A Quiz as the Learner sees it before starting: no question and no answer key. */
export interface ILearnerQuiz {
  id: string;
  courseId: string;
  title: string;
  passingScore: number;
  timeLimitMinutes: number | null;
  questionCount: number;
  isRequired: boolean;
  readOnly: boolean;
  attempts: ILearnerAttemptState;
  /** The attempt being done now, if any, to continue it. */
  inProgressAttemptId: string | null;
  /** BR-198: the score of the best attempt, null before any attempt was submitted. */
  recordedScore: number | null;
  passed: boolean | null;
  submittedAttemptCount: number;
}

export interface IAttemptOption {
  id: string;
  position: number;
  content: string;
}

export interface IAttemptQuestion {
  id: string;
  position: number;
  type: string;
  content: string;
  options: IAttemptOption[];
  /** Ids of the options the Learner has chosen so far. */
  selectedOptionIds: string[];
}

export interface IAttemptInProgress {
  status: 'InProgress';
  attemptId: string;
  assessmentId: string;
  attemptNumber: number;
  title: string;
  startedAt: string;
  deadlineAt: string;
  /** The clock of the server when the answer was built, so the screen counts down from the server's time (BR-200). */
  serverNow: string;
  remainingSeconds: number;
  questions: IAttemptQuestion[];
  /** true when this call returned an attempt that was already running instead of starting a new one. */
  resumed?: boolean;
}

export interface IAttemptResult {
  status: 'Submitted';
  attemptId: string;
  assessmentId: string;
  attemptNumber: number;
  title: string;
  startedAt: string;
  submittedAt: string;
  submissionKind: string;
  score: number;
  passed: boolean;
  correctCount: number;
  totalQuestions: number;
  passingScore: number;
  /** BR-198: the best score so far, which may come from another attempt. */
  recordedScore: number | null;
  recordedPassed: boolean | null;
  attempts: ILearnerAttemptState;
  /** true when the attempt had already been submitted before this call. */
  alreadySubmitted?: boolean;
}

export type IAttemptView = IAttemptInProgress | IAttemptResult;

export interface ISavedAnswer {
  questionId: string;
  selectedOptionIds: string[];
  remainingSeconds: number;
}
