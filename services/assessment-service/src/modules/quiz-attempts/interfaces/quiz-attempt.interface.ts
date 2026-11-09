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

/** UC29.2: one attempt in the history of a Quiz. */
export interface IAttemptHistoryItem {
  attemptId: string;
  attemptNumber: number;
  status: 'InProgress' | 'Submitted';
  startedAt: string;
  submittedAt: string | null;
  /** `Manual` or `TimedOut`; null while the attempt runs. */
  submissionKind: string | null;
  score: number | null;
  passed: boolean | null;
  correctCount: number | null;
  totalQuestions: number;
  /** BR-198: the attempt whose score is the recorded one. */
  isRecorded: boolean;
}

/** UC29.2: the attempts of a Learner on a Quiz with the score of each, the tries left and when the Quiz opens again. */
export interface IQuizHistory {
  quizId: string;
  courseId: string;
  title: string;
  passingScore: number;
  readOnly: boolean;
  attempts: ILearnerAttemptState;
  recordedScore: number | null;
  passed: boolean | null;
  /** Newest first. */
  items: IAttemptHistoryItem[];
}
