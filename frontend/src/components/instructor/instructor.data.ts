// Static demo data shared across Instructor course-lifecycle pages
// (Dashboard -> My Courses -> Course Detail -> Create/Edit/Delete Course).
// Frontend-only, no backend calls. Later batches (Course Builder, Submissions,
// Peer Cycles, Monitoring, Evaluations) will extend this file.

export type CourseVisibility = "Public" | "Private";
export type CourseStatus = "draft" | "submitted" | "rejected" | "published";

export interface ICourse {
  id: string;
  title: string;
  shortDescription: string;
  trainingObjective: string;
  learningOutcomes: string[];
  visibility: CourseVisibility;
  status: CourseStatus;
  locked: boolean;
  version: string;
  learners: number | null;
  plannedCompletionDays: number | null;
  rejectionReason?: string;
  hasPastEnrollment?: boolean;
  // The version number that is actually live/Published for Learners. Undefined
  // until the Course is Published for the first time. When `version` differs
  // from `publishedVersion`, a new Draft version is in progress alongside the
  // still-live Published version.
  publishedVersion?: string;
}

export const courseStatusLabel: Record<CourseStatus, string> = {
  draft: "Draft",
  submitted: "Submitted",
  rejected: "Rejected",
  published: "Published",
};

export const courseStatusTone: Record<
  CourseStatus,
  "neutral" | "success" | "warning" | "error" | "info"
> = {
  draft: "neutral",
  submitted: "info",
  rejected: "error",
  published: "success",
};

export const instructorCourses: ICourse[] = [
  {
    id: "workplace-safety",
    title: "Workplace Safety Essentials",
    shortDescription: "An introduction to workplace safety practices",
    trainingObjective: "Provide organizational safety guidance and practical procedures.",
    learningOutcomes: [
      "Recognize required procedures.",
      "Apply guidance in relevant workplace scenarios.",
    ],
    visibility: "Public",
    status: "draft",
    locked: false,
    version: "v1",
    learners: null,
    plannedCompletionDays: null,
  },
  {
    id: "data-protection",
    title: "Data Protection Basics",
    shortDescription: "Learn the essentials of handling organizational data.",
    trainingObjective: "Understand how to handle organizational data responsibly.",
    learningOutcomes: [
      "Understand how to handle organizational data responsibly.",
      "Apply internal processes when using shared information.",
    ],
    visibility: "Private",
    status: "submitted",
    locked: false,
    version: "v1",
    learners: null,
    plannedCompletionDays: 21,
  },
  {
    id: "service-communication",
    title: "Service Communication",
    shortDescription: "Practice clear communication in everyday work.",
    trainingObjective: "Practice clear, professional communication in everyday work.",
    learningOutcomes: [
      "Communicate clearly with colleagues and customers.",
      "Apply the Organization's communication standards.",
    ],
    visibility: "Public",
    status: "published",
    locked: true,
    version: "v1",
    learners: null,
    plannedCompletionDays: null,
    publishedVersion: "v1",
  },
  {
    id: "operational-procedures",
    title: "Operational Procedures",
    shortDescription: "Core operating procedures for daily tasks.",
    trainingObjective: "Explain the core operating procedures used in daily tasks.",
    learningOutcomes: [
      "Follow the documented operating procedure for common tasks.",
      "Identify who to contact when a step is unclear.",
    ],
    visibility: "Private",
    status: "rejected",
    locked: false,
    version: "v1",
    learners: null,
    plannedCompletionDays: 14,
    rejectionReason:
      "The submitted Course did not include a completed Assignment for every required Module.",
    hasPastEnrollment: true,
  },
];

export const findInstructorCourse = (courseId?: string) =>
  instructorCourses.find((course) => course.id === courseId);

export const removeInstructorCourse = (courseId: string) => {
  const index = instructorCourses.findIndex((course) => course.id === courseId);
  if (index !== -1) instructorCourses.splice(index, 1);
};

export const addInstructorCourse = (course: ICourse) => {
  instructorCourses.unshift(course);
};

export const draftCourseCount = () =>
  instructorCourses.filter((course) => course.status === "draft").length;

export const submittedCourseCount = () =>
  instructorCourses.filter((course) => course.status === "submitted").length;

export const coursesRequiringAttention = () =>
  instructorCourses.filter((course) => course.status !== "published");

// ---- Publishing lifecycle (Batch 4): submit -> Organizer decision -> Published/Rejected, versioning ----

export const canSubmitCourse = (course: ICourse) =>
  course.status === "draft" || course.status === "rejected";

export const submitCourseForApproval = (course: ICourse) => {
  course.status = "submitted";
  course.rejectionReason = undefined;
};

export const withdrawCourseSubmission = (course: ICourse) => {
  if (course.status !== "submitted") return;
  course.status = "draft";
};

export interface ICourseVersionRecord {
  version: string;
  statusLabel: string;
  createdDate: string;
  publishedDate: string;
  learners: string;
  completed: string;
  certificates: string;
}

// Builds the Version Chain table rows for a Published Course: the in-progress
// Draft version (if a new one has been started) followed by the currently
// live Published version. Figures the Organization has not yet computed are
// rendered as literal placeholders, consistent with the rest of this demo data.
export const courseVersionRecords = (course: ICourse): ICourseVersionRecord[] => {
  const records: ICourseVersionRecord[] = [];
  if (course.publishedVersion && course.version !== course.publishedVersion) {
    records.push({
      version: course.version,
      statusLabel: "Draft",
      createdDate: "[Date]",
      publishedDate: "—",
      learners: "—",
      completed: "—",
      certificates: "—",
    });
  }
  if (course.publishedVersion) {
    records.push({
      version: course.publishedVersion,
      statusLabel: "Published · Current",
      createdDate: "[Date]",
      publishedDate: "[Date]",
      learners: "[Count]",
      completed: "[Count]",
      certificates: "[Count]",
    });
  }
  return records;
};

export const canCreateNewCourseVersion = (course: ICourse) =>
  Boolean(course.locked && course.publishedVersion && course.version === course.publishedVersion);

// Copies a Locked, Published Course into a new Draft version. The previous
// version stays live for enrolled Learners (`publishedVersion` is unchanged)
// until the new version is itself approved and Published by the Organizer.
export const createNewCourseVersion = (course: ICourse) => {
  const currentNumber = Number.parseInt(course.version.replace(/[^0-9]/g, ""), 10) || 1;
  course.publishedVersion = course.publishedVersion ?? course.version;
  course.version = `v${currentNumber + 1}`;
  course.status = "draft";
  course.locked = false;
};

// ---- Grading and peer review (Batch 5): Submissions queue, direct grading, ----
// score discrepancy resolution, grade finalization and Peer Review Cycle management.
// A Submission either completes Peer Review (average recorded, Instructor finalizes
// and publishes) or is graded directly by the Instructor (Peer Review off,
// insufficient reviewers in the cycle, a missed review, or a score discrepancy
// beyond the Assignment's configured threshold). A consecutive resubmission made
// after its original cycle has closed always routes to the Instructor directly.

export type SubmissionReviewState =
  | "awaiting-review"
  | "discrepancy"
  | "insufficient-reviews"
  | "ready-to-publish"
  | "graded";

export interface IPeerReviewEntry {
  reviewerName: string;
  scoreLabel: string;
  feedbackLabel: string;
}

export interface ISubmissionCriterionComparison {
  criterionLabel: string;
  reviewerAScoreLabel: string;
  reviewerBScoreLabel: string;
  differenceLabel: string;
}

export interface ISubmission {
  id: string;
  courseId: string;
  assignmentId: string;
  assignmentTitle: string;
  learnerName: string;
  reviewState: SubmissionReviewState;
  scoreLabel: string;
  interventionLabel: string;
  reviewers: IPeerReviewEntry[];
  criteriaComparison: ISubmissionCriterionComparison[];
  isResubmission: boolean;
  finalScore?: number;
  feedback?: string;
  published: boolean;
}

export const instructorSubmissions: ISubmission[] = [
  {
    id: "sub-alex-morgan",
    courseId: "workplace-safety",
    assignmentId: "safety-assignment",
    assignmentTitle: "Safety Assignment",
    learnerName: "Alex Morgan",
    reviewState: "awaiting-review",
    scoreLabel: "—",
    interventionLabel: "—",
    reviewers: [],
    criteriaComparison: [],
    isResubmission: false,
    published: false,
  },
  {
    id: "sub-riley-park",
    courseId: "workplace-safety",
    assignmentId: "safety-assignment",
    assignmentTitle: "Safety Assignment",
    learnerName: "Riley Park",
    reviewState: "discrepancy",
    scoreLabel: "[Average]",
    interventionLabel: "Review required",
    reviewers: [
      { reviewerName: "Alex Morgan", scoreLabel: "[Score]", feedbackLabel: "[Comment]" },
      { reviewerName: "Taylor Kim", scoreLabel: "[Score]", feedbackLabel: "[Comment]" },
    ],
    criteriaComparison: [
      {
        criterionLabel: "Criterion 1",
        reviewerAScoreLabel: "[Score]",
        reviewerBScoreLabel: "[Score]",
        differenceLabel: "[Difference]",
      },
      {
        criterionLabel: "Criterion 2",
        reviewerAScoreLabel: "[Score]",
        reviewerBScoreLabel: "[Score]",
        differenceLabel: "[Difference]",
      },
      {
        criterionLabel: "Criterion 3",
        reviewerAScoreLabel: "[Score]",
        reviewerBScoreLabel: "[Score]",
        differenceLabel: "[Difference]",
      },
    ],
    isResubmission: false,
    published: false,
  },
  {
    id: "sub-taylor-kim",
    courseId: "workplace-safety",
    assignmentId: "safety-assignment",
    assignmentTitle: "Safety Assignment",
    learnerName: "Taylor Kim",
    reviewState: "insufficient-reviews",
    scoreLabel: "—",
    interventionLabel: "Grade directly",
    reviewers: [],
    criteriaComparison: [],
    isResubmission: false,
    published: false,
  },
  {
    id: "sub-sam-lee",
    courseId: "workplace-safety",
    assignmentId: "safety-assignment",
    assignmentTitle: "Safety Assignment",
    learnerName: "Sam Lee",
    reviewState: "ready-to-publish",
    scoreLabel: "[Score]",
    interventionLabel: "Finalize",
    reviewers: [
      { reviewerName: "Alex Morgan", scoreLabel: "[Score]", feedbackLabel: "[Comment]" },
      { reviewerName: "Taylor Kim", scoreLabel: "[Score]", feedbackLabel: "[Comment]" },
    ],
    criteriaComparison: [],
    isResubmission: false,
    published: false,
  },
  {
    id: "sub-alex-morgan-resubmission",
    courseId: "workplace-safety",
    assignmentId: "safety-assignment",
    assignmentTitle: "Safety Assignment",
    learnerName: "Alex Morgan",
    reviewState: "insufficient-reviews",
    scoreLabel: "—",
    interventionLabel: "Resubmission — grade directly",
    reviewers: [],
    criteriaComparison: [],
    isResubmission: true,
    published: false,
  },
];

export const findSubmission = (submissionId?: string) =>
  instructorSubmissions.find((submission) => submission.id === submissionId);

export const submissionsForAssignment = (assignmentId: string) =>
  instructorSubmissions.filter((submission) => submission.assignmentId === assignmentId);

export const publishSubmissionGrade = (
  submission: ISubmission,
  finalScore: number,
  feedback: string,
) => {
  submission.finalScore = finalScore;
  submission.feedback = feedback;
  submission.published = true;
  submission.reviewState = "graded";
  submission.scoreLabel = String(finalScore);
  submission.interventionLabel = "Published";
};

export const saveDirectGrade = (submission: ISubmission, finalScore: number, feedback: string) => {
  submission.finalScore = finalScore;
  submission.feedback = feedback;
  submission.reviewState = "graded";
  submission.scoreLabel = String(finalScore);
  submission.interventionLabel = "Draft saved";
};

// ---- Peer Review Cycles ----

export interface IPeerCycleSubmissionRow {
  label: string;
  reviewsDoneLabel: string;
  reviewsMissingLabel: string;
}

export interface IPeerCycleReviewerRow {
  id: string;
  name: string;
  assignedLabel: string;
  completedLabel: string;
  waived: boolean;
}

export type PeerCycleStatus = "Completed" | "Review in progress" | "Open";

export interface IPeerCycle {
  id: string;
  courseId: string;
  assignmentId: string;
  assignmentTitle: string;
  label: string;
  openedLabel: string;
  closedLabel: string;
  reviewDeadlineLabel: string;
  submissionsCountLabel: string;
  status: PeerCycleStatus;
  submissions: IPeerCycleSubmissionRow[];
  reviewers: IPeerCycleReviewerRow[];
}

export const instructorPeerCycles: IPeerCycle[] = [
  {
    id: "cycle-a",
    courseId: "workplace-safety",
    assignmentId: "safety-assignment",
    assignmentTitle: "Safety Assignment",
    label: "Cycle A",
    openedLabel: "[Date]",
    closedLabel: "[Date]",
    reviewDeadlineLabel: "[Date]",
    submissionsCountLabel: "[Count]",
    status: "Completed",
    submissions: [],
    reviewers: [],
  },
  {
    id: "cycle-b",
    courseId: "workplace-safety",
    assignmentId: "safety-assignment",
    assignmentTitle: "Safety Assignment",
    label: "Cycle B",
    openedLabel: "[Date]",
    closedLabel: "[Date]",
    reviewDeadlineLabel: "[Date]",
    submissionsCountLabel: "[Count]",
    status: "Review in progress",
    submissions: [
      { label: "Submission A", reviewsDoneLabel: "[Done]", reviewsMissingLabel: "[Missing]" },
      { label: "Submission B", reviewsDoneLabel: "[Done]", reviewsMissingLabel: "[Missing]" },
      { label: "Submission C", reviewsDoneLabel: "[Done]", reviewsMissingLabel: "[Missing]" },
    ],
    reviewers: [
      { id: "alex-morgan", name: "Alex Morgan", assignedLabel: "[Count]", completedLabel: "[Count]", waived: false },
      { id: "taylor-kim", name: "Taylor Kim", assignedLabel: "[Count]", completedLabel: "[Count]", waived: false },
      { id: "sam-lee", name: "Sam Lee", assignedLabel: "[Count]", completedLabel: "[Count]", waived: false },
    ],
  },
  {
    id: "cycle-c",
    courseId: "workplace-safety",
    assignmentId: "safety-assignment",
    assignmentTitle: "Safety Assignment",
    label: "Cycle C",
    openedLabel: "[Date]",
    closedLabel: "Not yet",
    reviewDeadlineLabel: "—",
    submissionsCountLabel: "[Count]",
    status: "Open",
    submissions: [],
    reviewers: [],
  },
];

export const findPeerCycle = (cycleId?: string) =>
  instructorPeerCycles.find((cycle) => cycle.id === cycleId);

export const findPeerCycleReviewer = (cycle: IPeerCycle, reviewerId?: string) =>
  cycle.reviewers.find((reviewer) => reviewer.id === reviewerId);

export const waivePeerCycleReviewer = (cycle: IPeerCycle, reviewerId: string) => {
  const reviewer = findPeerCycleReviewer(cycle, reviewerId);
  if (reviewer) reviewer.waived = true;
};

export const cyclesApproachingDeadline = () =>
  instructorPeerCycles.filter((cycle) => cycle.status === "Review in progress");

export const discrepancySubmissions = () =>
  instructorSubmissions.filter((submission) => submission.reviewState === "discrepancy");

// ---- Dashboard grading highlights (Batch 1 placeholders; wired in Batch 5) ----

export interface IGradingHighlight {
  label: string;
  to: string;
}

export const gradingHighlights: IGradingHighlight[] = [
  { label: "Submissions requiring direct grading", to: "/instructor/submissions" },
  { label: "Peer review cycles approaching deadline", to: "/instructor/peer-cycles" },
  { label: "Review score discrepancies", to: "/instructor/submissions" },
];

// ---- Course quota (demo flag driving the Course Quota Blocked screen) ----
// Starts one Course under the Organization's Subscription limit so the
// Create Course wizard is reachable end-to-end. Creating a Draft Course
// consumes the remaining slot, so a second attempt hits the limit — a real,
// client-side-reachable path to the Quota Blocked screen rather than an
// orphan route.

export const instructorCourseQuota = {
  limit: instructorCourses.length + 1,
  used: instructorCourses.length,
};

export const isCourseQuotaReached = () =>
  instructorCourseQuota.used >= instructorCourseQuota.limit;

export const consumeCourseQuota = () => {
  instructorCourseQuota.used += 1;
};

// ---- Course Builder (Batch 2): Module -> Lesson -> learning material tree ----
// A Course's structure is locked as a whole once the Organization records the
// Course's first Enrollment (mirrors `ICourse.locked` above). Independently,
// an individual Lesson's content becomes locked once at least one Learner has
// completed that Lesson, even if the wider Course structure is still open.

export type BuilderResourceType = "video" | "reading";

export interface IBuilderResource {
  id: string;
  title: string;
  type: BuilderResourceType;
  required: boolean;
  sizeLabel: string;
}

export interface IBuilderLesson {
  id: string;
  title: string;
  required: boolean;
  introText: string;
  completedByLearner: boolean;
  resources: IBuilderResource[];
}

export interface IBuilderModule {
  id: string;
  title: string;
  required: boolean;
  quizTitle?: string;
  lessons: IBuilderLesson[];
}

// ---- Quizzes and Assignments (Batch 3): course- or module-level assessments ----
// A Quiz's Questions and answer keys lock independently once at least one Learner
// has attempted it; an Assignment locks its Instructions/Rubric/attempt rules once
// Submission data exists. Both are separate from the wider Course structure lock.

export type QuizLocation = "module" | "course";
export type QuizQuestionType = "single" | "multiple" | "true-false";

export interface IBuilderQuizOption {
  id: string;
  text: string;
  correct: boolean;
}

export interface IBuilderQuizQuestion {
  id: string;
  type: QuizQuestionType;
  text: string;
  options: IBuilderQuizOption[];
}

export interface IBuilderQuiz {
  id: string;
  title: string;
  location: QuizLocation;
  moduleId?: string;
  required: boolean;
  timeLimitMinutes?: number;
  passingScore?: number;
  attempts?: number;
  lockHours?: number;
  locked: boolean;
  questions: IBuilderQuizQuestion[];
}

export interface IBuilderRubricCriterion {
  id: string;
  description: string;
  maxScore?: number;
}

export interface IBuilderAssignment {
  id: string;
  title: string;
  instructions: string;
  passingScore?: number;
  estimatedEffortMinutes?: number;
  consecutiveSubmissions?: number;
  lockHours?: number;
  rubric: IBuilderRubricCriterion[];
  peerReviewEnabled: boolean;
  reviewersPerSubmission?: number;
  cycleLengthDays?: number;
  reviewDeadlineDays?: number;
  scoreDiscrepancyThreshold?: number;
  locked: boolean;
}

export interface ICourseStructure {
  courseId: string;
  modules: IBuilderModule[];
  assignmentTitle?: string;
  quizzes: IBuilderQuiz[];
  assignments: IBuilderAssignment[];
}

export const courseStructures: Record<string, ICourseStructure> = {
  "workplace-safety": {
    courseId: "workplace-safety",
    modules: [
      {
        id: "m1",
        title: "Module 1 · Foundations",
        required: true,
        quizTitle: "Module 1 Quiz",
        lessons: [
          {
            id: "m1-l1",
            title: "Lesson 1 · Introduction",
            required: true,
            introText: "This Lesson introduces the Course and its safety expectations.",
            completedByLearner: false,
            resources: [
              {
                id: "m1-l1-video",
                title: "Introduction video",
                type: "video",
                required: true,
                sizeLabel: "[Size]",
              },
              {
                id: "m1-l1-reading",
                title: "Course handbook",
                type: "reading",
                required: true,
                sizeLabel: "[Size]",
              },
            ],
          },
        ],
      },
      {
        id: "m2",
        title: "Module 2 · Practice",
        required: true,
        quizTitle: "Module 2 Quiz",
        lessons: [
          {
            id: "m2-l1",
            title: "Lesson 1 · Safety procedures",
            required: true,
            introText:
              "This Lesson introduces practical safety procedures.\nReview the examples and required materials before the Quiz.",
            completedByLearner: false,
            resources: [
              {
                id: "m2-l1-video",
                title: "Safety procedures video",
                type: "video",
                required: true,
                sizeLabel: "[Size]",
              },
              {
                id: "m2-l1-reading",
                title: "Working safely reading",
                type: "reading",
                required: true,
                sizeLabel: "[Size]",
              },
            ],
          },
        ],
      },
    ],
    assignmentTitle: "Safety Assignment",
    quizzes: [
      {
        id: "m1-quiz",
        title: "Module 1 Quiz",
        location: "module",
        moduleId: "m1",
        required: false,
        locked: false,
        questions: [],
      },
      {
        id: "m2-quiz",
        title: "Module 2 Quiz",
        location: "module",
        moduleId: "m2",
        required: true,
        locked: false,
        questions: [
          {
            id: "m2-quiz-q1",
            type: "single",
            text: "Follow the safety process?",
            options: [
              { id: "m2-quiz-q1-a", text: "Follow the procedure", correct: true },
              { id: "m2-quiz-q1-b", text: "Skip required checks", correct: false },
              { id: "m2-quiz-q1-c", text: "Ignore instructions", correct: false },
            ],
          },
          {
            id: "m2-quiz-q2",
            type: "multiple",
            text: "Select all required checks.",
            options: [
              { id: "m2-quiz-q2-a", text: "Review guidance", correct: true },
              { id: "m2-quiz-q2-b", text: "Complete checks", correct: true },
              { id: "m2-quiz-q2-c", text: "Skip the procedure", correct: false },
            ],
          },
          {
            id: "m2-quiz-q3",
            type: "true-false",
            text: "An overdue Course is still accessible.",
            options: [
              { id: "m2-quiz-q3-a", text: "True", correct: true },
              { id: "m2-quiz-q3-b", text: "False", correct: false },
            ],
          },
        ],
      },
      {
        id: "final-quiz",
        title: "Final Quiz",
        location: "course",
        required: true,
        locked: false,
        questions: [],
      },
    ],
    assignments: [
      {
        id: "safety-assignment",
        title: "Safety Assignment",
        instructions: "Prepare a response using the documented safety procedures.",
        rubric: [
          { id: "safety-assignment-c1", description: "Completeness of response" },
          { id: "safety-assignment-c2", description: "Application of procedure" },
          { id: "safety-assignment-c3", description: "Clarity of explanation" },
        ],
        peerReviewEnabled: true,
        locked: false,
      },
      {
        id: "practice-reflection",
        title: "Practice reflection",
        instructions: "Write a short reflection on today's practice session.",
        rubric: [{ id: "practice-reflection-c1", description: "Depth of reflection" }],
        peerReviewEnabled: false,
        locked: false,
      },
    ],
  },
  "service-communication": {
    courseId: "service-communication",
    modules: [
      {
        id: "m1",
        title: "Module 1 · Core skills",
        required: true,
        lessons: [
          {
            id: "m1-l1",
            title: "Lesson 1 · Communication basics",
            required: true,
            introText: "This Lesson introduces communication basics.",
            completedByLearner: true,
            resources: [
              {
                id: "m1-l1-video",
                title: "Communication basics video",
                type: "video",
                required: true,
                sizeLabel: "[Size]",
              },
              {
                id: "m1-l1-reading",
                title: "Service handbook",
                type: "reading",
                required: true,
                sizeLabel: "[Size]",
              },
            ],
          },
        ],
      },
    ],
    assignmentTitle: "Communication Assignment",
    quizzes: [
      {
        id: "communication-final-quiz",
        title: "Final Quiz",
        location: "course",
        required: true,
        timeLimitMinutes: 20,
        passingScore: 80,
        attempts: 2,
        lockHours: 24,
        locked: true,
        questions: [
          {
            id: "communication-final-quiz-q1",
            type: "single",
            text: "Which greeting matches the Organization's standard?",
            options: [
              { id: "communication-final-quiz-q1-a", text: "Use the approved greeting script", correct: true },
              { id: "communication-final-quiz-q1-b", text: "Use any informal greeting", correct: false },
            ],
          },
        ],
      },
    ],
    assignments: [
      {
        id: "communication-assignment",
        title: "Communication Assignment",
        instructions: "Respond to the sample customer scenario using the Service Communication standard.",
        passingScore: 70,
        estimatedEffortMinutes: 30,
        consecutiveSubmissions: 2,
        lockHours: 24,
        rubric: [
          { id: "communication-assignment-c1", description: "Tone and professionalism", maxScore: 10 },
          { id: "communication-assignment-c2", description: "Accuracy of information", maxScore: 10 },
        ],
        peerReviewEnabled: true,
        reviewersPerSubmission: 2,
        cycleLengthDays: 5,
        reviewDeadlineDays: 3,
        scoreDiscrepancyThreshold: 15,
        locked: true,
      },
    ],
  },
};

export const findCourseStructure = (courseId?: string) =>
  courseId ? courseStructures[courseId] : undefined;

export const findBuilderModule = (structure: ICourseStructure, moduleId?: string) =>
  structure.modules.find((module) => module.id === moduleId);

export const findBuilderLesson = (structure: ICourseStructure, lessonId?: string) => {
  for (const module of structure.modules) {
    const lesson = module.lessons.find((item) => item.id === lessonId);
    if (lesson) return { module, lesson };
  }
  return undefined;
};

export const findBuilderResource = (
  structure: ICourseStructure,
  lessonId?: string,
  resourceId?: string,
) => {
  const found = findBuilderLesson(structure, lessonId);
  if (!found) return undefined;
  const resource = found.lesson.resources.find((item) => item.id === resourceId);
  if (!resource) return undefined;
  return { ...found, resource };
};

export const addBuilderModule = (
  structure: ICourseStructure,
  module: Omit<IBuilderModule, "lessons">,
) => {
  structure.modules.push({ ...module, lessons: [] });
};

export const addBuilderLesson = (
  structure: ICourseStructure,
  moduleId: string,
  lesson: Omit<IBuilderLesson, "resources" | "completedByLearner">,
) => {
  const module = findBuilderModule(structure, moduleId);
  if (!module) return;
  module.lessons.push({ ...lesson, completedByLearner: false, resources: [] });
};

export const addBuilderResource = (
  structure: ICourseStructure,
  lessonId: string,
  resource: IBuilderResource,
) => {
  const found = findBuilderLesson(structure, lessonId);
  if (!found) return;
  found.lesson.resources.push(resource);
};

export const removeBuilderModule = (structure: ICourseStructure, moduleId: string) => {
  const index = structure.modules.findIndex((module) => module.id === moduleId);
  if (index !== -1) structure.modules.splice(index, 1);
};

export const removeBuilderLesson = (structure: ICourseStructure, lessonId: string) => {
  for (const module of structure.modules) {
    const index = module.lessons.findIndex((lesson) => lesson.id === lessonId);
    if (index !== -1) {
      module.lessons.splice(index, 1);
      return;
    }
  }
};

export const removeBuilderResource = (structure: ICourseStructure, resourceId: string) => {
  for (const module of structure.modules) {
    for (const lesson of module.lessons) {
      const index = lesson.resources.findIndex((resource) => resource.id === resourceId);
      if (index !== -1) {
        lesson.resources.splice(index, 1);
        return;
      }
    }
  }
};

export const moveBuilderModule = (structure: ICourseStructure, moduleId: string, delta: 1 | -1) => {
  const index = structure.modules.findIndex((module) => module.id === moduleId);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= structure.modules.length) return;
  const [module] = structure.modules.splice(index, 1);
  structure.modules.splice(target, 0, module);
};

export const moveBuilderLesson = (
  structure: ICourseStructure,
  moduleId: string,
  lessonId: string,
  delta: 1 | -1,
) => {
  const module = findBuilderModule(structure, moduleId);
  if (!module) return;
  const index = module.lessons.findIndex((lesson) => lesson.id === lessonId);
  const target = index + delta;
  if (index === -1 || target < 0 || target >= module.lessons.length) return;
  const [lesson] = module.lessons.splice(index, 1);
  module.lessons.splice(target, 0, lesson);
};

export const slugify = (value: string) =>
  `${value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "")}-${Date.now().toString().slice(-5)}`;

// ---- Quiz helpers ----

export const findBuilderQuiz = (structure: ICourseStructure, quizId?: string) =>
  structure.quizzes.find((quiz) => quiz.id === quizId);

export const findBuilderQuizQuestion = (quiz: IBuilderQuiz, questionId?: string) =>
  quiz.questions.find((question) => question.id === questionId);

export const addBuilderQuiz = (structure: ICourseStructure, quiz: IBuilderQuiz) => {
  structure.quizzes.push(quiz);
};

export const removeBuilderQuiz = (structure: ICourseStructure, quizId: string) => {
  const index = structure.quizzes.findIndex((quiz) => quiz.id === quizId);
  if (index !== -1) structure.quizzes.splice(index, 1);
};

export const addBuilderQuizQuestion = (quiz: IBuilderQuiz, question: IBuilderQuizQuestion) => {
  quiz.questions.push(question);
};

export const saveBuilderQuizQuestion = (quiz: IBuilderQuiz, question: IBuilderQuizQuestion) => {
  const index = quiz.questions.findIndex((item) => item.id === question.id);
  if (index === -1) {
    quiz.questions.push(question);
  } else {
    quiz.questions[index] = question;
  }
};

export const removeBuilderQuizQuestion = (quiz: IBuilderQuiz, questionId: string) => {
  const index = quiz.questions.findIndex((question) => question.id === questionId);
  if (index !== -1) quiz.questions.splice(index, 1);
};

export const quizLocationLabel = (structure: ICourseStructure, quiz: IBuilderQuiz) => {
  if (quiz.location === "course") return "Course";
  const module = findBuilderModule(structure, quiz.moduleId);
  return module?.title.split("·")[0]?.trim() || module?.title || "Module";
};

export const quizQuestionTypeLabel: Record<QuizQuestionType, string> = {
  single: "Single answer",
  multiple: "Multiple answers",
  "true-false": "True / False",
};

// ---- Assignment helpers ----

export const findBuilderAssignment = (structure: ICourseStructure, assignmentId?: string) =>
  structure.assignments.find((assignment) => assignment.id === assignmentId);

export const addBuilderAssignment = (structure: ICourseStructure, assignment: IBuilderAssignment) => {
  structure.assignments.push(assignment);
};

export const removeBuilderAssignment = (structure: ICourseStructure, assignmentId: string) => {
  const index = structure.assignments.findIndex((assignment) => assignment.id === assignmentId);
  if (index !== -1) structure.assignments.splice(index, 1);
};

export const addRubricCriterion = (assignment: IBuilderAssignment, criterion: IBuilderRubricCriterion) => {
  assignment.rubric.push(criterion);
};

export const removeRubricCriterion = (assignment: IBuilderAssignment, criterionId: string) => {
  const index = assignment.rubric.findIndex((criterion) => criterion.id === criterionId);
  if (index !== -1) assignment.rubric.splice(index, 1);
};

// ---- Monitoring (Batch 6): cross-course Learner progress/compliance overview ----
// scoped to Courses this Instructor currently owns.

export type MonitoringEnrollmentType = "Required" | "Optional";
export type MonitoringCompletionStatus = "Not started" | "In progress" | "Completed";
export type MonitoringDueStatus = "Overdue" | "No deadline" | "In progress";

export interface IMonitoringRow {
  learnerId: string;
  learnerName: string;
  courseId: string;
  courseTitle: string;
  enrollmentType: MonitoringEnrollmentType;
  progressLabel: string;
  resultLabel: string;
  completionStatus: MonitoringCompletionStatus;
  dueStatus: MonitoringDueStatus;
}

export const monitoringRows: IMonitoringRow[] = [
  {
    learnerId: "alex-morgan",
    learnerName: "Alex Morgan",
    courseId: "workplace-safety",
    courseTitle: "Workplace Safety Essentials",
    enrollmentType: "Required",
    progressLabel: "[Progress]",
    resultLabel: "[Result]",
    completionStatus: "In progress",
    dueStatus: "Overdue",
  },
  {
    learnerId: "taylor-kim",
    learnerName: "Taylor Kim",
    courseId: "workplace-safety",
    courseTitle: "Workplace Safety Essentials",
    enrollmentType: "Optional",
    progressLabel: "[Progress]",
    resultLabel: "[Result]",
    completionStatus: "Not started",
    dueStatus: "No deadline",
  },
  {
    learnerId: "sam-lee",
    learnerName: "Sam Lee",
    courseId: "data-protection",
    courseTitle: "Data Protection Basics",
    enrollmentType: "Required",
    progressLabel: "[Progress]",
    resultLabel: "[Result]",
    completionStatus: "In progress",
    dueStatus: "In progress",
  },
];

export interface IMonitoringFilters {
  courseTitle?: string;
  learnerName?: string;
  enrollmentType?: MonitoringEnrollmentType;
  completionStatus?: MonitoringCompletionStatus;
}

export const monitoringFilters: IMonitoringFilters = {};

export const monitoringCourseOptions = () =>
  Array.from(new Set(monitoringRows.map((row) => row.courseTitle)));

export const monitoringLearnerOptions = () =>
  Array.from(new Set(monitoringRows.map((row) => row.learnerName)));

export const applyMonitoringFilters = (filters: IMonitoringFilters) => {
  monitoringFilters.courseTitle = filters.courseTitle;
  monitoringFilters.learnerName = filters.learnerName;
  monitoringFilters.enrollmentType = filters.enrollmentType;
  monitoringFilters.completionStatus = filters.completionStatus;
};

export const resetMonitoringFilters = () => {
  monitoringFilters.courseTitle = undefined;
  monitoringFilters.learnerName = undefined;
  monitoringFilters.enrollmentType = undefined;
  monitoringFilters.completionStatus = undefined;
};

export const hasActiveMonitoringFilters = () =>
  Boolean(
    monitoringFilters.courseTitle ||
      monitoringFilters.learnerName ||
      monitoringFilters.enrollmentType ||
      monitoringFilters.completionStatus,
  );

export const filteredMonitoringRows = () =>
  monitoringRows.filter((row) => {
    if (monitoringFilters.courseTitle && row.courseTitle !== monitoringFilters.courseTitle) return false;
    if (monitoringFilters.learnerName && row.learnerName !== monitoringFilters.learnerName) return false;
    if (monitoringFilters.enrollmentType && row.enrollmentType !== monitoringFilters.enrollmentType)
      return false;
    if (monitoringFilters.completionStatus && row.completionStatus !== monitoringFilters.completionStatus)
      return false;
    return true;
  });

export const findMonitoringRow = (courseId?: string, learnerId?: string) =>
  monitoringRows.find((row) => row.courseId === courseId && row.learnerId === learnerId);

// ---- Learner Progress drill-down ----

export interface ILearnerProgressComponent {
  component: string;
  completion: string;
  result: string;
  attention: string;
}

const learnerProgressByPair: Record<string, ILearnerProgressComponent[]> = {
  "workplace-safety__alex-morgan": [
    { component: "Module 1 required resources", completion: "Complete", result: "—", attention: "—" },
    { component: "Module 2 required resources", completion: "In progress", result: "—", attention: "Continue" },
    { component: "Module 2 Quiz", completion: "Completed", result: "[Highest attempt]", attention: "—" },
    { component: "Safety Assignment", completion: "Awaiting grade", result: "[Latest submission]", attention: "Grade" },
  ],
};

export const learnerProgressComponents = (courseId: string, learnerId: string): ILearnerProgressComponent[] =>
  learnerProgressByPair[`${courseId}__${learnerId}`] ?? [
    { component: "Module 1 required resources", completion: "[Status]", result: "—", attention: "—" },
    { component: "Module 2 required resources", completion: "[Status]", result: "—", attention: "—" },
  ];

export const dueStatusMessage: Record<MonitoringDueStatus, string> = {
  Overdue: "Overdue • Learner can continue learning",
  "No deadline": "No deadline • Learner can continue learning",
  "In progress": "In progress • Learner can continue learning",
};

export const dueStatusTone: Record<MonitoringDueStatus, "error" | "neutral" | "warning"> = {
  Overdue: "error",
  "No deadline": "neutral",
  "In progress": "warning",
};

// ---- Evaluations (Batch 6): aggregated anonymous Course evaluation ratings ----

export interface IEvaluationCriterionSummary {
  label: string;
  averageLabel: string;
  previousVersionLabel: string;
  participationLabel: string;
}

export interface ICourseEvaluationSummary {
  courseId: string;
  courseTitle: string;
  version: string;
  completedLabel: string;
  eligibleLabel: string;
  criteria: IEvaluationCriterionSummary[];
}

export const courseEvaluationSummary: ICourseEvaluationSummary = {
  courseId: "workplace-safety",
  courseTitle: "Workplace Safety Essentials",
  version: "v1",
  completedLabel: "[Count]",
  eligibleLabel: "[Eligible]",
  criteria: [
    {
      label: "Usefulness of content",
      averageLabel: "[Average]",
      previousVersionLabel: "[v0 average]",
      participationLabel: "[Rate]",
    },
    {
      label: "Appropriateness of difficulty",
      averageLabel: "[Average]",
      previousVersionLabel: "[v0 average]",
      participationLabel: "[Rate]",
    },
    {
      label: "Quality of learning materials",
      averageLabel: "[Average]",
      previousVersionLabel: "[v0 average]",
      participationLabel: "[Rate]",
    },
  ],
};

export const anonymousEvaluationComments: string[] = [
  "The examples helped me apply the material.",
  "The reading material was clear and easy to follow.",
  "More practice scenarios would be useful.",
];

// ---- Content moderation (Batch 6): Organizer-confirmed content violations on ----
// Courses this Instructor owns, reachable from Course Detail.

export interface IContentModerationCase {
  courseId: string;
  reportedItemTitle: string;
  lessonId?: string;
  decisionLabel: string;
  severityLabel: string;
  correctionReason: string;
  contentDisabled: boolean;
  correctionSubmitted: boolean;
  reconsiderationSummary?: string;
  escalated: boolean;
  escalationReason?: string;
}

export const contentModerationCases: Record<string, IContentModerationCase> = {
  "workplace-safety": {
    courseId: "workplace-safety",
    reportedItemTitle: "Safety procedures Lesson",
    lessonId: "m2-l1",
    decisionLabel: "Confirmed violation",
    severityLabel: "[Decision]",
    correctionReason: "[Organizer-provided reason and required correction]",
    contentDisabled: true,
    correctionSubmitted: false,
    escalated: false,
  },
};

export const findContentModerationCase = (courseId?: string) =>
  courseId ? contentModerationCases[courseId] : undefined;

export const submitReconsideration = (item: IContentModerationCase, summary: string) => {
  item.correctionSubmitted = true;
  item.reconsiderationSummary = summary;
};

export const escalateContentDecision = (item: IContentModerationCase, reason: string) => {
  item.escalated = true;
  item.escalationReason = reason;
};
