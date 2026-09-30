// Static demo data shared across Learner course-lifecycle pages
// (Catalog -> Course Overview -> Enrollment -> Curriculum -> Lesson -> Resource -> Progress -> Withdraw).
// Frontend-only, no backend calls.

export type CourseAudience = "required" | "optional";
export type ResourceType = "video" | "reading";
export type ResourceStatus = "complete" | "in-progress" | "not-started";

export interface ICourseResource {
  id: string;
  title: string;
  type: ResourceType;
  required: boolean;
  status: ResourceStatus;
}

export interface ICourseLesson {
  id: string;
  title: string;
  resources: ICourseResource[];
}

export interface ICourseModule {
  id: string;
  title: string;
  quizTitle?: string;
  quizId?: string;
  lessons: ICourseLesson[];
}

// ---- Quizzes -----------------------------------------------------------

export type QuizQuestionType = "single" | "multiple" | "true-false";

export interface IQuizOption {
  id: string;
  label: string;
}

export interface IQuizQuestion {
  id: string;
  type: QuizQuestionType;
  text: string;
  options: IQuizOption[];
  correctOptionIds: string[];
}

export interface IQuizAttempt {
  id: string;
  submittedAt: string;
  score: number;
  passed: boolean;
}

export interface IQuiz {
  id: string;
  moduleId: string;
  title: string;
  requirement: string;
  minScore: number;
  timeLimitLabel: string;
  passingScoreLabel: string;
  maxConsecutiveAttempts: number;
  locked?: boolean;
  lockedUntil?: string;
  questions: IQuizQuestion[];
  attempts: IQuizAttempt[];
}

export const quizAttemptsRemaining = (quiz: IQuiz) => {
  let streak = 0;
  for (let i = quiz.attempts.length - 1; i >= 0; i -= 1) {
    if (quiz.attempts[i].passed) break;
    streak += 1;
  }
  return Math.max(quiz.maxConsecutiveAttempts - streak, 0);
};

export const quizRecordedScore = (quiz: IQuiz) =>
  quiz.attempts.reduce((max, attempt) => Math.max(max, attempt.score), 0);

// ---- Assignments ---------------------------------------------------------

export type AssignmentStatus = "not-submitted" | "submitted" | "returned" | "graded" | "locked";

export interface IAssignmentCriterion {
  name: string;
  score: number;
  maxScore: number;
  feedback: string;
}

export interface IAssignmentSubmission {
  answer: string;
  fileName?: string;
  submittedAt: string;
}

export interface IAssignmentGrading {
  finalScore: number;
  passThreshold: number;
  published: boolean;
  criteria: IAssignmentCriterion[];
}

export interface IAssignment {
  id: string;
  title: string;
  requirement: string;
  minScore: number;
  estimatedEffort: string;
  status: AssignmentStatus;
  attemptsRemaining: number;
  lockedUntil?: string;
  instructions: string[];
  rubric: string;
  submission?: IAssignmentSubmission;
  grading?: IAssignmentGrading;
}

export const assignmentStatusLabel = (status: AssignmentStatus) => {
  switch (status) {
    case "not-submitted":
      return "Not submitted";
    case "submitted":
      return "Awaiting grade";
    case "returned":
      return "Returned";
    case "graded":
      return "Reviewed";
    case "locked":
      return "Temporarily locked";
    default:
      return status;
  }
};

export interface ICourseDetail {
  id: string;
  title: string;
  version: string;
  audience: CourseAudience;
  progress: number;
  dueDate?: string;
  overdue?: boolean;
  disabled?: boolean;
  assessmentStarted?: boolean;
  activeLessonId: string;
  activeResourceId: string;
  completionConditionsMet: number;
  completionConditionsTotal: number;
  modules: ICourseModule[];
  quizzes: Record<string, IQuiz>;
  assessments: IAssignment[];
}

export const courseDetails: Record<string, ICourseDetail> = {
  "workplace-safety": {
    id: "workplace-safety",
    title: "Workplace Safety Essentials",
    version: "v1",
    audience: "required",
    progress: 65,
    dueDate: "23 Sep 2026",
    overdue: true,
    activeLessonId: "m2-l1",
    activeResourceId: "m2-l1-video",
    completionConditionsMet: 4,
    completionConditionsTotal: 6,
    modules: [
      {
        id: "m1",
        title: "Module 1 · Foundations",
        quizTitle: "Module 1 Quiz",
        quizId: "m1-quiz",
        lessons: [
          {
            id: "m1-l1",
            title: "Lesson 1 · Introduction",
            resources: [
              {
                id: "m1-l1-video",
                title: "Introduction video",
                type: "video",
                required: true,
                status: "complete",
              },
              {
                id: "m1-l1-reading",
                title: "Course handbook",
                type: "reading",
                required: true,
                status: "complete",
              },
            ],
          },
        ],
      },
      {
        id: "m2",
        title: "Module 2 · Practice",
        quizTitle: "Module 2 Quiz",
        quizId: "m2-quiz",
        lessons: [
          {
            id: "m2-l1",
            title: "Lesson 1 · Safety procedures",
            resources: [
              {
                id: "m2-l1-video",
                title: "Safety procedures video",
                type: "video",
                required: true,
                status: "in-progress",
              },
              {
                id: "m2-l1-reading",
                title: "Working safely",
                type: "reading",
                required: true,
                status: "not-started",
              },
              {
                id: "m2-l1-extra",
                title: "Additional reference",
                type: "reading",
                required: false,
                status: "not-started",
              },
            ],
          },
        ],
      },
    ],
    quizzes: {
      "m1-quiz": {
        id: "m1-quiz",
        moduleId: "m1",
        title: "Module 1 Quiz",
        requirement: "Required",
        minScore: 70,
        timeLimitLabel: "15 minutes",
        passingScoreLabel: "70%",
        maxConsecutiveAttempts: 3,
        questions: [
          {
            id: "m1-q1",
            type: "single",
            text: "Where should you check for the documented safety process?",
            options: [
              { id: "a", label: "The Course handbook" },
              { id: "b", label: "A personal notebook" },
              { id: "c", label: "An unrelated Course" },
              { id: "d", label: "Nowhere, it is not documented" },
            ],
            correctOptionIds: ["a"],
          },
          {
            id: "m1-q2",
            type: "true-false",
            text: "The Introduction video and Course handbook are both required Resources.",
            options: [
              { id: "true", label: "True" },
              { id: "false", label: "False" },
            ],
            correctOptionIds: ["true"],
          },
        ],
        attempts: [
          { id: "att-1", submittedAt: "18 Sep 2026, 09:14", score: 92, passed: true },
        ],
      },
      "m2-quiz": {
        id: "m2-quiz",
        moduleId: "m2",
        title: "Module 2 Quiz",
        requirement: "Required",
        minScore: 70,
        timeLimitLabel: "20 minutes",
        passingScoreLabel: "70%",
        maxConsecutiveAttempts: 3,
        questions: [
          {
            id: "m2-q1",
            type: "single",
            text: "Which action follows the documented safety process?",
            options: [
              { id: "a", label: "Review the assigned procedure" },
              { id: "b", label: "Skip the documented checks" },
              { id: "c", label: "Record completion without review" },
              { id: "d", label: "Ignore the required guidance" },
            ],
            correctOptionIds: ["a"],
          },
          {
            id: "m2-q2",
            type: "multiple",
            text: "Which actions support a safe work process?",
            options: [
              { id: "a", label: "Review the guidance" },
              { id: "b", label: "Complete required checks" },
              { id: "c", label: "Ignore the process" },
              { id: "d", label: "Record actions accurately" },
            ],
            correctOptionIds: ["a", "b"],
          },
          {
            id: "m2-q3",
            type: "true-false",
            text: "An overdue Required Course can still be completed.",
            options: [
              { id: "true", label: "True" },
              { id: "false", label: "False" },
            ],
            correctOptionIds: ["true"],
          },
          {
            id: "m2-q4",
            type: "single",
            text: "What should you do when a step is unclear?",
            options: [
              { id: "a", label: "Refer to the learning material" },
              { id: "b", label: "Mark it complete without reading" },
              { id: "c", label: "Skip the required Lesson" },
              { id: "d", label: "Ignore the instructions" },
            ],
            correctOptionIds: ["a"],
          },
          {
            id: "m2-q5",
            type: "multiple",
            text: "Which resources count when they are marked Required?",
            options: [
              { id: "a", label: "Required Video" },
              { id: "b", label: "Required Reading" },
              { id: "c", label: "Optional reference" },
              { id: "d", label: "Optional extra Reading" },
            ],
            correctOptionIds: ["a", "b"],
          },
        ],
        attempts: [],
      },
    },
    assessments: [
      {
        id: "safety-assignment",
        title: "Safety Assignment",
        requirement: "Always required",
        minScore: 70,
        estimatedEffort: "45 minutes",
        status: "not-submitted",
        attemptsRemaining: 2,
        instructions: [
          "Prepare a response using the documented safety procedures.",
          "Explain the steps you would take in the example scenario.",
        ],
        rubric: "Procedure adherence, clarity, and completeness of the explanation.",
      },
    ],
  },
  "operational-procedures": {
    id: "operational-procedures",
    title: "Operational Procedures",
    version: "v1",
    audience: "required",
    progress: 32,
    dueDate: "30 Sep 2026",
    activeLessonId: "m1-l1",
    activeResourceId: "m1-l1-video",
    completionConditionsMet: 2,
    completionConditionsTotal: 5,
    modules: [
      {
        id: "m1",
        title: "Module 1 · Core Procedures",
        quizTitle: "Module 1 Quiz",
        quizId: "m1-quiz",
        lessons: [
          {
            id: "m1-l1",
            title: "Lesson 1 · Getting started",
            resources: [
              {
                id: "m1-l1-video",
                title: "Getting started video",
                type: "video",
                required: true,
                status: "in-progress",
              },
              {
                id: "m1-l1-reading",
                title: "Procedures overview",
                type: "reading",
                required: true,
                status: "not-started",
              },
            ],
          },
        ],
      },
    ],
    quizzes: {
      "m1-quiz": {
        id: "m1-quiz",
        moduleId: "m1",
        title: "Module 1 Quiz",
        requirement: "Required",
        minScore: 70,
        timeLimitLabel: "15 minutes",
        passingScoreLabel: "70%",
        maxConsecutiveAttempts: 3,
        questions: [
          {
            id: "op-q1",
            type: "single",
            text: "What should you check before starting a procedure?",
            options: [
              { id: "a", label: "The procedures overview" },
              { id: "b", label: "Nothing, procedures are optional" },
              { id: "c", label: "A different Course" },
              { id: "d", label: "Your personal preference" },
            ],
            correctOptionIds: ["a"],
          },
          {
            id: "op-q2",
            type: "true-false",
            text: "Operational procedures can be adapted without approval.",
            options: [
              { id: "true", label: "True" },
              { id: "false", label: "False" },
            ],
            correctOptionIds: ["false"],
          },
        ],
        attempts: [
          { id: "att-1", submittedAt: "12 Sep 2026, 09:40", score: 60, passed: false },
          { id: "att-2", submittedAt: "15 Sep 2026, 14:10", score: 82, passed: true },
          { id: "att-3", submittedAt: "18 Sep 2026, 10:05", score: 58, passed: false },
        ],
      },
    },
    assessments: [
      {
        id: "operational-assignment",
        title: "Procedures Assignment",
        requirement: "Always required",
        minScore: 70,
        estimatedEffort: "30 minutes",
        status: "returned",
        attemptsRemaining: 1,
        instructions: [
          "Describe how you would apply the core procedures to the example scenario.",
          "Reference the specific steps from the procedures overview.",
        ],
        rubric: "Accuracy of the referenced steps and clarity of the explanation.",
        submission: {
          answer: "I would follow the checklist in the procedures overview and confirm each step with my supervisor.",
          submittedAt: "20 Sep 2026, 11:02",
        },
      },
    ],
  },
  "data-protection": {
    id: "data-protection",
    title: "Data Protection Basics",
    version: "v1",
    audience: "optional",
    progress: 48,
    assessmentStarted: false,
    activeLessonId: "m1-l1",
    activeResourceId: "m1-l1-video",
    completionConditionsMet: 1,
    completionConditionsTotal: 4,
    modules: [
      {
        id: "m1",
        title: "Module 1 · Information basics",
        quizTitle: "Module 1 Quiz",
        quizId: "m1-quiz",
        lessons: [
          {
            id: "m1-l1",
            title: "Lesson 1 · Handling data",
            resources: [
              {
                id: "m1-l1-video",
                title: "Handling data video",
                type: "video",
                required: true,
                status: "in-progress",
              },
              {
                id: "m1-l1-reading",
                title: "Data protection guide",
                type: "reading",
                required: true,
                status: "not-started",
              },
            ],
          },
        ],
      },
      {
        id: "m2",
        title: "Module 2 · Practical handling",
        lessons: [
          {
            id: "m2-l1",
            title: "Lesson 1 · Applying the rules",
            resources: [
              {
                id: "m2-l1-video",
                title: "Applying the rules video",
                type: "video",
                required: true,
                status: "not-started",
              },
            ],
          },
        ],
      },
    ],
    quizzes: {
      "m1-quiz": {
        id: "m1-quiz",
        moduleId: "m1",
        title: "Module 1 Quiz",
        requirement: "Required",
        minScore: 70,
        timeLimitLabel: "15 minutes",
        passingScoreLabel: "70%",
        maxConsecutiveAttempts: 3,
        locked: true,
        lockedUntil: "05 Oct 2026, 09:00",
        questions: [
          {
            id: "dp-q1",
            type: "single",
            text: "Who should you contact when handling data you are unsure about?",
            options: [
              { id: "a", label: "Your Organization's data guidance" },
              { id: "b", label: "A colleague outside the Organization" },
              { id: "c", label: "No one, guess" },
              { id: "d", label: "Public forums" },
            ],
            correctOptionIds: ["a"],
          },
        ],
        attempts: [
          { id: "att-1", submittedAt: "10 Sep 2026, 08:30", score: 40, passed: false },
          { id: "att-2", submittedAt: "12 Sep 2026, 16:05", score: 55, passed: false },
          { id: "att-3", submittedAt: "14 Sep 2026, 09:50", score: 50, passed: false },
        ],
      },
    },
    assessments: [
      {
        id: "data-assignment",
        title: "Data Handling Assignment",
        requirement: "Always required",
        minScore: 70,
        estimatedEffort: "30 minutes",
        status: "locked",
        attemptsRemaining: 0,
        lockedUntil: "05 Oct 2026, 09:00",
        instructions: [
          "Describe how you would classify and store a sample data record.",
          "Reference the Organization's data protection guide.",
        ],
        rubric: "Correct classification and adherence to the data protection guide.",
        submission: {
          answer: "Draft answer submitted while reviewing the classification rules.",
          submittedAt: "14 Sep 2026, 10:15",
        },
      },
    ],
  },
  "service-communication": {
    id: "service-communication",
    title: "Service Communication",
    version: "v1",
    audience: "optional",
    progress: 100,
    assessmentStarted: true,
    activeLessonId: "m1-l1",
    activeResourceId: "m1-l1-video",
    completionConditionsMet: 3,
    completionConditionsTotal: 3,
    modules: [
      {
        id: "m1",
        title: "Module 1 · Core skills",
        lessons: [
          {
            id: "m1-l1",
            title: "Lesson 1 · Communication basics",
            resources: [
              {
                id: "m1-l1-video",
                title: "Communication basics video",
                type: "video",
                required: true,
                status: "complete",
              },
              {
                id: "m1-l1-reading",
                title: "Service handbook",
                type: "reading",
                required: true,
                status: "complete",
              },
            ],
          },
        ],
      },
    ],
    quizzes: {},
    assessments: [
      {
        id: "service-assignment",
        title: "Communication Assignment",
        requirement: "Always required",
        minScore: 70,
        estimatedEffort: "30 minutes",
        status: "graded",
        attemptsRemaining: 1,
        instructions: [
          "Write a short response to the example customer scenario.",
          "Apply the Organization's communication standards.",
        ],
        rubric: "Clarity, tone, and adherence to the communication standards.",
        submission: {
          answer: "Thank you for reaching out — here is how we will resolve this together.",
          submittedAt: "16 Sep 2026, 13:45",
        },
        grading: {
          finalScore: 88,
          passThreshold: 70,
          published: true,
          criteria: [
            { name: "Clarity", score: 9, maxScore: 10, feedback: "Clear and easy to follow." },
            { name: "Tone", score: 9, maxScore: 10, feedback: "Professional and courteous." },
            {
              name: "Standards adherence",
              score: 8,
              maxScore: 10,
              feedback: "Followed the communication standards closely.",
            },
          ],
        },
      },
    ],
  },
  "vendor-compliance": {
    id: "vendor-compliance",
    title: "Vendor Compliance Training",
    version: "v1",
    audience: "required",
    progress: 40,
    disabled: true,
    activeLessonId: "m1-l1",
    activeResourceId: "m1-l1-video",
    completionConditionsMet: 1,
    completionConditionsTotal: 3,
    modules: [
      {
        id: "m1",
        title: "Module 1 · Compliance basics",
        lessons: [
          {
            id: "m1-l1",
            title: "Lesson 1 · Overview",
            resources: [
              {
                id: "m1-l1-video",
                title: "Overview video",
                type: "video",
                required: true,
                status: "in-progress",
              },
            ],
          },
        ],
      },
    ],
    quizzes: {},
    assessments: [],
  },
};

export const findLesson = (course: ICourseDetail, lessonId?: string) => {
  for (const module of course.modules) {
    const lesson = module.lessons.find((item) => item.id === lessonId);
    if (lesson) return { module, lesson };
  }
  return undefined;
};

export const findResource = (course: ICourseDetail, lessonId?: string, resourceId?: string) => {
  const found = findLesson(course, lessonId);
  if (!found) return undefined;
  const resource = found.lesson.resources.find((item) => item.id === resourceId);
  if (!resource) return undefined;
  return { ...found, resource };
};

export const findQuiz = (course: ICourseDetail, quizId?: string) =>
  quizId ? course.quizzes[quizId] : undefined;

export const findAssignment = (course: ICourseDetail, assignmentId?: string) =>
  course.assessments.find((assignment) => assignment.id === assignmentId);

export const countRemainingRequired = (course: ICourseDetail) =>
  course.modules.reduce(
    (total, module) =>
      total +
      module.lessons.reduce(
        (lessonTotal, lesson) =>
          lessonTotal +
          lesson.resources.filter((resource) => resource.required && resource.status !== "complete")
            .length,
        0,
      ),
    0,
  );

export interface ICatalogCourseDetail {
  id: string;
  title: string;
  description: string;
  status: string;
  objectives: string[];
  modules: { label: string; name: string }[];
  certificateConditions: string;
  previouslyWithdrawn?: boolean;
}

// ---- Peer Review ---------------------------------------------------------

export type PeerReviewStatus = "pending" | "completed";

export interface IPeerReviewResult {
  scores: number[];
  feedback: string;
  completedAt: string;
}

export interface IPeerReviewTask {
  id: string;
  assignmentTitle: string;
  reviewDeadline: string;
  status: PeerReviewStatus;
  submittedResponse: string;
  attachmentName?: string;
  criteria: string[];
  hiddenFromQueue?: boolean;
  result?: IPeerReviewResult;
}

export const peerReviewTasks: IPeerReviewTask[] = [
  {
    id: "PR-027",
    assignmentTitle: "Safety Assignment",
    reviewDeadline: "28 Sep 2026",
    status: "pending",
    submittedResponse:
      "[Learner submission content displayed without identifying details.]",
    attachmentName: "safety-response-pr027.pdf",
    criteria: ["Criterion 1", "Criterion 2", "Criterion 3"],
  },
  {
    id: "PR-031",
    assignmentTitle: "Safety Assignment",
    reviewDeadline: "28 Sep 2026",
    status: "pending",
    submittedResponse:
      "[Learner submission content displayed without identifying details.]",
    attachmentName: "safety-response-pr031.pdf",
    criteria: ["Criterion 1", "Criterion 2", "Criterion 3"],
  },
  {
    id: "PR-018",
    assignmentTitle: "Safety Assignment",
    reviewDeadline: "21 Sep 2026",
    status: "completed",
    submittedResponse:
      "[Learner submission content displayed without identifying details.]",
    attachmentName: "safety-response-pr018.pdf",
    criteria: ["Criterion 1", "Criterion 2", "Criterion 3"],
    result: {
      scores: [4, 5, 4],
      feedback: "Clear reasoning and followed the documented procedure closely.",
      completedAt: "21 Sep 2026, 16:20",
    },
  },
  {
    id: "PR-011",
    assignmentTitle: "Safety Assignment",
    reviewDeadline: "12 Sep 2026",
    status: "completed",
    submittedResponse:
      "[Learner submission content displayed without identifying details.]",
    attachmentName: "safety-response-pr011.pdf",
    criteria: ["Criterion 1", "Criterion 2", "Criterion 3"],
    hiddenFromQueue: true,
    result: {
      scores: [3, 4, 4],
      feedback: "Good structure; could reference the handbook more directly.",
      completedAt: "12 Sep 2026, 09:05",
    },
  },
];

export const findPeerReviewTask = (submissionId?: string) =>
  peerReviewTasks.find((task) => task.id === submissionId);

// ---- Certificates ---------------------------------------------------------

export interface ICertificate {
  id: string;
  courseTitle: string;
  version: string;
  issuedDate: string;
  completionDate: string;
  completionLabel: "On time" | "Completed late";
  certificateId: string;
}

export const certificates: ICertificate[] = [
  {
    id: "cert-service-communication",
    courseTitle: "Service Communication",
    version: "v1",
    issuedDate: "18 Sep 2026",
    completionDate: "18 Sep 2026",
    completionLabel: "On time",
    certificateId: "CERT-2026-0142",
  },
  {
    id: "cert-data-protection",
    courseTitle: "Data Protection Basics",
    version: "v2",
    issuedDate: "08 Sep 2026",
    completionDate: "05 Sep 2026",
    completionLabel: "Completed late",
    certificateId: "CERT-2026-0098",
  },
];

export const findCertificate = (certificateId?: string) =>
  certificates.find((certificate) => certificate.id === certificateId);

// ---- Content Reports -------------------------------------------------------

export type ReportContentType = "Lesson" | "Video" | "Reading" | "Quiz" | "Assignment";
export type ReportStatus = "pending" | "dismissed" | "resolved";

export interface IContentReport {
  id: string;
  reportedItem: string;
  contentType: ReportContentType;
  courseTitle: string;
  submittedDate: string;
  status: ReportStatus;
  decision?: "No violation" | "Confirmed";
  reason: string;
}

export const contentReports: IContentReport[] = [
  {
    id: "report-1",
    reportedItem: "Safety procedures lesson",
    contentType: "Lesson",
    courseTitle: "Workplace Safety Essentials",
    submittedDate: "25 Sep 2026",
    status: "pending",
    reason: "The safety steps listed do not match the current documented procedure.",
  },
  {
    id: "report-2",
    reportedItem: "Module Quiz content",
    contentType: "Quiz",
    courseTitle: "Operational Procedures",
    submittedDate: "18 Sep 2026",
    status: "dismissed",
    decision: "No violation",
    reason: "Quiz question 3 seems to have two correct answers.",
  },
  {
    id: "report-3",
    reportedItem: "Working safely Reading",
    contentType: "Reading",
    courseTitle: "Workplace Safety Essentials",
    submittedDate: "14 Sep 2026",
    status: "resolved",
    decision: "Confirmed",
    reason: "The reading references an outdated regulation.",
  },
];

export const findContentReport = (reportId?: string) =>
  contentReports.find((report) => report.id === reportId);

// ---- Course Evaluation -----------------------------------------------------

export type EvaluationStatus = "not-started" | "open" | "closed";

export interface ICourseEvaluationRatings {
  usefulness: number;
  difficulty: number;
  quality: number;
}

export interface ICourseEvaluation {
  courseId: string;
  status: EvaluationStatus;
  ratings?: ICourseEvaluationRatings;
  comments?: string;
  windowCloseDate?: string;
}

export const courseEvaluations: Record<string, ICourseEvaluation> = {
  "service-communication": {
    courseId: "service-communication",
    status: "open",
    ratings: { usefulness: 4, difficulty: 4, quality: 4 },
    comments: "The materials were clear and useful.",
    windowCloseDate: "05 Oct 2026",
  },
  "operational-procedures": {
    courseId: "operational-procedures",
    status: "not-started",
    windowCloseDate: "12 Oct 2026",
  },
  "data-protection": {
    courseId: "data-protection",
    status: "closed",
  },
};

export const findCourseEvaluation = (courseId?: string) =>
  courseId ? courseEvaluations[courseId] : undefined;

export const catalogCourseDetails: Record<string, ICatalogCourseDetail> = {
  "data-protection": {
    id: "data-protection",
    title: "Data Protection Basics",
    description: "Learn the essentials of handling organizational data.",
    status: "Published",
    objectives: [
      "Understand how to handle organizational data responsibly.",
      "Apply internal processes when using shared information.",
    ],
    modules: [
      { label: "Module 1", name: "Information basics" },
      { label: "Module 2", name: "Practical handling" },
    ],
    certificateConditions:
      "Complete required learning materials, required Quizzes and all Assignments. Peer review duties apply when assigned.",
    previouslyWithdrawn: true,
  },
  "service-communication": {
    id: "service-communication",
    title: "Service Communication",
    description: "Practice clear communication in everyday work.",
    status: "Published",
    objectives: [
      "Communicate clearly with colleagues and customers.",
      "Apply the Organization's communication standards.",
    ],
    modules: [
      { label: "Module 1", name: "Core skills" },
      { label: "Module 2", name: "Applied practice" },
    ],
    certificateConditions:
      "Complete required learning materials, required Quizzes and all Assignments. Peer review duties apply when assigned.",
    previouslyWithdrawn: false,
  },
  "time-management": {
    id: "time-management",
    title: "Effective Time Management",
    description: "Build habits for prioritizing daily work.",
    status: "Published",
    objectives: [
      "Prioritize daily tasks against team goals.",
      "Apply simple planning techniques to reduce overload.",
    ],
    modules: [
      { label: "Module 1", name: "Planning fundamentals" },
      { label: "Module 2", name: "Staying on track" },
    ],
    certificateConditions:
      "Complete required learning materials, required Quizzes and all Assignments. Peer review duties apply when assigned.",
    previouslyWithdrawn: false,
  },
};
