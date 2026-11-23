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
  maxConsecutiveAttempts: number;
  lockedUntil?: string;
  instructions: string[];
  rubric: string;
  submission?: IAssignmentSubmission;
  grading?: IAssignmentGrading;
}

export const assignmentStatusLabel = (status: AssignmentStatus) => {
  switch (status) {
    case "not-submitted":
      return "Chưa nộp";
    case "submitted":
      return "Chờ chấm điểm";
    case "returned":
      return "Đã trả bài";
    case "graded":
      return "Đã chấm";
    case "locked":
      return "Tạm khóa";
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
    title: "Kiến thức cơ bản về an toàn lao động",
    version: "v1",
    audience: "required",
    progress: 65,
    dueDate: "23/09/2026",
    overdue: true,
    activeLessonId: "m2-l1",
    activeResourceId: "m2-l1-video",
    completionConditionsMet: 4,
    completionConditionsTotal: 6,
    modules: [
      {
        id: "m1",
        title: "Chương 1 · Kiến thức nền tảng",
        quizTitle: "Bài trắc nghiệm chương 1",
        quizId: "m1-quiz",
        lessons: [
          {
            id: "m1-l1",
            title: "Bài học 1 · Giới thiệu",
            resources: [
              {
                id: "m1-l1-video",
                title: "Video giới thiệu",
                type: "video",
                required: true,
                status: "complete",
              },
              {
                id: "m1-l1-reading",
                title: "Sổ tay khóa học",
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
        title: "Chương 2 · Thực hành",
        quizTitle: "Bài trắc nghiệm chương 2",
        quizId: "m2-quiz",
        lessons: [
          {
            id: "m2-l1",
            title: "Bài học 1 · Quy trình an toàn",
            resources: [
              {
                id: "m2-l1-video",
                title: "Video về quy trình an toàn",
                type: "video",
                required: true,
                status: "in-progress",
              },
              {
                id: "m2-l1-reading",
                title: "Làm việc an toàn",
                type: "reading",
                required: true,
                status: "not-started",
              },
              {
                id: "m2-l1-extra",
                title: "Tài liệu tham khảo bổ sung",
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
        title: "Bài trắc nghiệm chương 1",
        requirement: "Bắt buộc",
        minScore: 70,
        timeLimitLabel: "15 phút",
        passingScoreLabel: "70%",
        maxConsecutiveAttempts: 3,
        questions: [
          {
            id: "m1-q1",
            type: "single",
            text: "Bạn nên tra cứu quy trình an toàn ở đâu?",
            options: [
              { id: "a", label: "Sổ tay khóa học" },
              { id: "b", label: "Sổ tay cá nhân" },
              { id: "c", label: "Một khóa học không liên quan" },
              { id: "d", label: "Không có nơi nào vì quy trình chưa được ghi lại" },
            ],
            correctOptionIds: ["a"],
          },
          {
            id: "m1-q2",
            type: "true-false",
            text: "Video giới thiệu và sổ tay khóa học đều là học liệu bắt buộc.",
            options: [
              { id: "true", label: "Đúng" },
              { id: "false", label: "Sai" },
            ],
            correctOptionIds: ["true"],
          },
        ],
        attempts: [
          { id: "att-1", submittedAt: "18/09/2026 09:14", score: 92, passed: true },
        ],
      },
      "m2-quiz": {
        id: "m2-quiz",
        moduleId: "m2",
        title: "Bài trắc nghiệm chương 2",
        requirement: "Bắt buộc",
        minScore: 70,
        timeLimitLabel: "20 phút",
        passingScoreLabel: "70%",
        maxConsecutiveAttempts: 3,
        questions: [
          {
            id: "m2-q1",
            type: "single",
            text: "Hành động nào tuân thủ quy trình an toàn đã được ghi lại?",
            options: [
              { id: "a", label: "Xem lại quy trình được giao" },
              { id: "b", label: "Bỏ qua các bước kiểm tra đã quy định" },
              { id: "c", label: "Ghi nhận hoàn thành mà chưa xem lại" },
              { id: "d", label: "Bỏ qua hướng dẫn bắt buộc" },
            ],
            correctOptionIds: ["a"],
          },
          {
            id: "m2-q2",
            type: "multiple",
            text: "Những hành động nào giúp bảo đảm an toàn khi làm việc?",
            options: [
              { id: "a", label: "Xem lại hướng dẫn" },
              { id: "b", label: "Hoàn thành các bước kiểm tra bắt buộc" },
              { id: "c", label: "Bỏ qua quy trình" },
              { id: "d", label: "Ghi lại các hành động một cách chính xác" },
            ],
            correctOptionIds: ["a", "b"],
          },
          {
            id: "m2-q3",
            type: "true-false",
            text: "Bạn vẫn có thể hoàn thành khóa học bắt buộc đã quá hạn.",
            options: [
              { id: "true", label: "Đúng" },
              { id: "false", label: "Sai" },
            ],
            correctOptionIds: ["true"],
          },
          {
            id: "m2-q4",
            type: "single",
            text: "Bạn nên làm gì khi chưa hiểu rõ một bước?",
            options: [
              { id: "a", label: "Tham khảo học liệu" },
              { id: "b", label: "Đánh dấu hoàn thành mà chưa đọc" },
              { id: "c", label: "Bỏ qua bài học bắt buộc" },
              { id: "d", label: "Bỏ qua hướng dẫn" },
            ],
            correctOptionIds: ["a"],
          },
          {
            id: "m2-q5",
            type: "multiple",
            text: "Học liệu nào được tính khi được đánh dấu bắt buộc?",
            options: [
              { id: "a", label: "Video bắt buộc" },
              { id: "b", label: "Tài liệu đọc bắt buộc" },
              { id: "c", label: "Tài liệu tham khảo tự chọn" },
              { id: "d", label: "Tài liệu đọc bổ sung tự chọn" },
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
        title: "Bài tập về an toàn lao động",
        requirement: "Luôn bắt buộc",
        minScore: 70,
        estimatedEffort: "45 phút",
        status: "not-submitted",
        maxConsecutiveAttempts: 3,
        attemptsRemaining: 3,
        instructions: [
          "Soạn câu trả lời dựa trên các quy trình an toàn đã được ghi lại.",
          "Giải thích các bước bạn sẽ thực hiện trong tình huống mẫu.",
        ],
        rubric: "Nội dung – Mức độ tuân thủ quy trình, sự rõ ràng và đầy đủ của phần giải thích.",
      },
    ],
  },
  "operational-procedures": {
    id: "operational-procedures",
    title: "Quy trình vận hành",
    version: "v1",
    audience: "required",
    progress: 32,
    dueDate: "30/09/2026",
    activeLessonId: "m1-l1",
    activeResourceId: "m1-l1-video",
    completionConditionsMet: 2,
    completionConditionsTotal: 5,
    modules: [
      {
        id: "m1",
        title: "Chương 1 · Quy trình cốt lõi",
        quizTitle: "Bài trắc nghiệm chương 1",
        quizId: "m1-quiz",
        lessons: [
          {
            id: "m1-l1",
            title: "Bài học 1 · Bắt đầu",
            resources: [
              {
                id: "m1-l1-video",
                title: "Video hướng dẫn bắt đầu",
                type: "video",
                required: true,
                status: "in-progress",
              },
              {
                id: "m1-l1-reading",
                title: "Tổng quan quy trình",
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
        title: "Bài trắc nghiệm chương 1",
        requirement: "Bắt buộc",
        minScore: 70,
        timeLimitLabel: "15 phút",
        passingScoreLabel: "70%",
        maxConsecutiveAttempts: 3,
        questions: [
          {
            id: "op-q1",
            type: "single",
            text: "Bạn nên kiểm tra gì trước khi thực hiện một quy trình?",
            options: [
              { id: "a", label: "Bản tổng quan quy trình" },
              { id: "b", label: "Không cần kiểm tra vì quy trình là tự chọn" },
              { id: "c", label: "Một khóa học khác" },
              { id: "d", label: "Sở thích cá nhân" },
            ],
            correctOptionIds: ["a"],
          },
          {
            id: "op-q2",
            type: "true-false",
            text: "Có thể điều chỉnh quy trình vận hành mà không cần phê duyệt.",
            options: [
              { id: "true", label: "Đúng" },
              { id: "false", label: "Sai" },
            ],
            correctOptionIds: ["false"],
          },
        ],
        attempts: [
          { id: "att-1", submittedAt: "12/09/2026 09:40", score: 60, passed: false },
          { id: "att-2", submittedAt: "15/09/2026 14:10", score: 82, passed: true },
          { id: "att-3", submittedAt: "18/09/2026 10:05", score: 58, passed: false },
        ],
      },
    },
    assessments: [
      {
        id: "operational-assignment",
        title: "Bài tập về quy trình vận hành",
        requirement: "Luôn bắt buộc",
        minScore: 70,
        estimatedEffort: "30 phút",
        status: "returned",
        maxConsecutiveAttempts: 3,
        attemptsRemaining: 1,
        instructions: [
          "Mô tả cách áp dụng các quy trình cốt lõi vào tình huống mẫu.",
          "Dẫn chiếu các bước cụ thể trong bản tổng quan quy trình.",
        ],
        rubric: "Độ chính xác của các bước được dẫn chiếu và sự rõ ràng của phần giải thích.",
        submission: {
          answer: "Tôi sẽ làm theo danh sách kiểm tra trong bản tổng quan quy trình và xác nhận từng bước với người giám sát.",
          submittedAt: "20/09/2026 11:02",
        },
      },
    ],
  },
  "data-protection": {
    id: "data-protection",
    title: "Kiến thức cơ bản về bảo vệ dữ liệu",
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
        title: "Chương 1 · Kiến thức cơ bản về thông tin",
        quizTitle: "Bài trắc nghiệm chương 1",
        quizId: "m1-quiz",
        lessons: [
          {
            id: "m1-l1",
            title: "Bài học 1 · Xử lý dữ liệu",
            resources: [
              {
                id: "m1-l1-video",
                title: "Video về xử lý dữ liệu",
                type: "video",
                required: true,
                status: "in-progress",
              },
              {
                id: "m1-l1-reading",
                title: "Hướng dẫn bảo vệ dữ liệu",
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
        title: "Chương 2 · Thực hành xử lý dữ liệu",
        lessons: [
          {
            id: "m2-l1",
            title: "Bài học 1 · Áp dụng quy định",
            resources: [
              {
                id: "m2-l1-video",
                title: "Video về áp dụng quy định",
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
        title: "Bài trắc nghiệm chương 1",
        requirement: "Bắt buộc",
        minScore: 70,
        timeLimitLabel: "15 phút",
        passingScoreLabel: "70%",
        maxConsecutiveAttempts: 3,
        locked: true,
        lockedUntil: "05/10/2026 09:00",
        questions: [
          {
            id: "dp-q1",
            type: "single",
            text: "Bạn nên liên hệ với ai khi chưa rõ cách xử lý dữ liệu?",
            options: [
              { id: "a", label: "Bộ phận hướng dẫn về dữ liệu của tổ chức bạn" },
              { id: "b", label: "Một đồng nghiệp ngoài tổ chức" },
              { id: "c", label: "Không liên hệ ai và tự đoán" },
              { id: "d", label: "Diễn đàn công khai" },
            ],
            correctOptionIds: ["a"],
          },
        ],
        attempts: [
          { id: "att-1", submittedAt: "10/09/2026 08:30", score: 40, passed: false },
          { id: "att-2", submittedAt: "12/09/2026 16:05", score: 55, passed: false },
          { id: "att-3", submittedAt: "14/09/2026 09:50", score: 50, passed: false },
        ],
      },
    },
    assessments: [
      {
        id: "data-assignment",
        title: "Bài tập về xử lý dữ liệu",
        requirement: "Luôn bắt buộc",
        minScore: 70,
        estimatedEffort: "30 phút",
        status: "locked",
        maxConsecutiveAttempts: 3,
        attemptsRemaining: 0,
        lockedUntil: "05/10/2026 09:00",
        instructions: [
          "Mô tả cách phân loại và lưu trữ một bản ghi dữ liệu mẫu.",
          "Dẫn chiếu hướng dẫn bảo vệ dữ liệu của tổ chức.",
        ],
        rubric: "Phân loại chính xác và tuân thủ hướng dẫn bảo vệ dữ liệu.",
        submission: {
          answer: "Bản nháp câu trả lời được gửi trong lúc xem lại quy tắc phân loại.",
          submittedAt: "14/09/2026 10:15",
        },
      },
    ],
  },
  "service-communication": {
    id: "service-communication",
    title: "Giao tiếp trong dịch vụ",
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
        title: "Chương 1 · Kỹ năng cốt lõi",
        lessons: [
          {
            id: "m1-l1",
            title: "Bài học 1 · Giao tiếp cơ bản",
            resources: [
              {
                id: "m1-l1-video",
                title: "Video về giao tiếp cơ bản",
                type: "video",
                required: true,
                status: "complete",
              },
              {
                id: "m1-l1-reading",
                title: "Sổ tay dịch vụ",
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
        title: "Bài tập về giao tiếp",
        requirement: "Luôn bắt buộc",
        minScore: 70,
        estimatedEffort: "30 phút",
        status: "graded",
        maxConsecutiveAttempts: 3,
        attemptsRemaining: 1,
        instructions: [
          "Viết một câu trả lời ngắn cho tình huống khách hàng mẫu.",
          "Áp dụng các chuẩn mực giao tiếp của tổ chức.",
        ],
        rubric: "Sự rõ ràng, giọng điệu và mức độ tuân thủ chuẩn mực giao tiếp.",
        submission: {
          answer: "Cảm ơn bạn đã liên hệ. Chúng tôi sẽ cùng bạn giải quyết theo các bước sau.",
          submittedAt: "16/09/2026 13:45",
        },
        grading: {
          finalScore: 88,
          passThreshold: 70,
          published: true,
          criteria: [
            { name: "Sự rõ ràng", score: 9, maxScore: 10, feedback: "Rõ ràng và dễ theo dõi." },
            { name: "Giọng điệu", score: 9, maxScore: 10, feedback: "Chuyên nghiệp và lịch sự." },
            {
              name: "Tuân thủ chuẩn mực",
              score: 8,
              maxScore: 10,
              feedback: "Tuân thủ tốt các chuẩn mực giao tiếp.",
            },
          ],
        },
      },
    ],
  },
  "vendor-compliance": {
    id: "vendor-compliance",
    title: "Đào tạo về tuân thủ cho nhà cung cấp",
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
        title: "Chương 1 · Kiến thức cơ bản về tuân thủ",
        lessons: [
          {
            id: "m1-l1",
            title: "Bài học 1 · Tổng quan",
            resources: [
              {
                id: "m1-l1-video",
                title: "Video tổng quan",
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
    assignmentTitle: "Bài tập An toàn lao động",
    reviewDeadline: "28/09/2026",
    status: "pending",
    submittedResponse:
      "[Nội dung bài nộp của học viên, hiển thị không kèm thông tin nhận dạng.]",
    attachmentName: "safety-response-pr027.pdf",
    criteria: ["Tiêu chí 1", "Tiêu chí 2", "Tiêu chí 3"],
  },
  {
    id: "PR-031",
    assignmentTitle: "Bài tập An toàn lao động",
    reviewDeadline: "28/09/2026",
    status: "pending",
    submittedResponse:
      "[Nội dung bài nộp của học viên, hiển thị không kèm thông tin nhận dạng.]",
    attachmentName: "safety-response-pr031.pdf",
    criteria: ["Tiêu chí 1", "Tiêu chí 2", "Tiêu chí 3"],
  },
  {
    id: "PR-018",
    assignmentTitle: "Bài tập An toàn lao động",
    reviewDeadline: "21/09/2026",
    status: "completed",
    submittedResponse:
      "[Nội dung bài nộp của học viên, hiển thị không kèm thông tin nhận dạng.]",
    attachmentName: "safety-response-pr018.pdf",
    criteria: ["Tiêu chí 1", "Tiêu chí 2", "Tiêu chí 3"],
    result: {
      scores: [4, 5, 4],
      feedback: "Lập luận rõ ràng và bám sát quy trình đã ghi trong tài liệu.",
      completedAt: "21/09/2026, 16:20",
    },
  },
  {
    id: "PR-011",
    assignmentTitle: "Bài tập An toàn lao động",
    reviewDeadline: "12/09/2026",
    status: "completed",
    submittedResponse:
      "[Nội dung bài nộp của học viên, hiển thị không kèm thông tin nhận dạng.]",
    attachmentName: "safety-response-pr011.pdf",
    criteria: ["Tiêu chí 1", "Tiêu chí 2", "Tiêu chí 3"],
    hiddenFromQueue: true,
    result: {
      scores: [3, 4, 4],
      feedback: "Bố cục tốt; có thể dẫn chiếu sổ tay trực tiếp hơn.",
      completedAt: "12/09/2026, 09:05",
    },
  },
];

export const findPeerReviewTask = (submissionId?: string) =>
  peerReviewTasks.find((task) => task.id === submissionId);

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
    reportedItem: "Bài học về quy trình an toàn",
    contentType: "Lesson",
    courseTitle: "Kiến thức cơ bản về an toàn lao động",
    submittedDate: "25/09/2026",
    status: "pending",
    reason: "Các bước an toàn được liệt kê chưa khớp với quy trình hiện hành.",
  },
  {
    id: "report-2",
    reportedItem: "Nội dung bài trắc nghiệm của chương",
    contentType: "Quiz",
    courseTitle: "Quy trình vận hành",
    submittedDate: "18/09/2026",
    status: "dismissed",
    decision: "No violation",
    reason: "Câu hỏi trắc nghiệm số 3 có vẻ có hai đáp án đúng.",
  },
  {
    id: "report-3",
    reportedItem: "Tài liệu đọc về cách làm việc an toàn",
    contentType: "Reading",
    courseTitle: "Kiến thức cơ bản về an toàn lao động",
    submittedDate: "14/09/2026",
    status: "resolved",
    decision: "Confirmed",
    reason: "Tài liệu đọc dẫn chiếu một quy định đã lỗi thời.",
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
    comments: "Học liệu rõ ràng và hữu ích.",
    windowCloseDate: "05/10/2026",
  },
  "operational-procedures": {
    courseId: "operational-procedures",
    status: "not-started",
    windowCloseDate: "12/10/2026",
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
    title: "Kiến thức cơ bản về bảo vệ dữ liệu",
    description: "Học những kiến thức thiết yếu về xử lý dữ liệu của tổ chức.",
    status: "Published",
    objectives: [
      "Hiểu cách xử lý dữ liệu của tổ chức một cách có trách nhiệm.",
      "Áp dụng quy trình nội bộ khi sử dụng thông tin dùng chung.",
    ],
    modules: [
      { label: "Chương 1", name: "Kiến thức cơ bản về thông tin" },
      { label: "Chương 2", name: "Thực hành xử lý dữ liệu" },
    ],
    certificateConditions:
      "Hoàn thành học liệu bắt buộc, bài trắc nghiệm bắt buộc và tất cả bài tập. Thực hiện nhiệm vụ chấm chéo khi được giao.",
    previouslyWithdrawn: true,
  },
  "service-communication": {
    id: "service-communication",
    title: "Giao tiếp trong dịch vụ",
    description: "Rèn luyện cách giao tiếp rõ ràng trong công việc hằng ngày.",
    status: "Published",
    objectives: [
      "Giao tiếp rõ ràng với đồng nghiệp và khách hàng.",
      "Áp dụng các chuẩn mực giao tiếp của tổ chức.",
    ],
    modules: [
      { label: "Chương 1", name: "Kỹ năng cốt lõi" },
      { label: "Chương 2", name: "Thực hành ứng dụng" },
    ],
    certificateConditions:
      "Hoàn thành học liệu bắt buộc, bài trắc nghiệm bắt buộc và tất cả bài tập. Thực hiện nhiệm vụ chấm chéo khi được giao.",
    previouslyWithdrawn: false,
  },
  "time-management": {
    id: "time-management",
    title: "Quản lý thời gian hiệu quả",
    description: "Hình thành thói quen sắp xếp thứ tự ưu tiên cho công việc hằng ngày.",
    status: "Published",
    objectives: [
      "Ưu tiên công việc hằng ngày dựa trên mục tiêu của nhóm.",
      "Áp dụng kỹ thuật lập kế hoạch đơn giản để giảm quá tải.",
    ],
    modules: [
      { label: "Chương 1", name: "Kiến thức nền tảng về lập kế hoạch" },
      { label: "Chương 2", name: "Bám sát kế hoạch" },
    ],
    certificateConditions:
      "Hoàn thành học liệu bắt buộc, bài trắc nghiệm bắt buộc và tất cả bài tập. Thực hiện nhiệm vụ chấm chéo khi được giao.",
    previouslyWithdrawn: false,
  },
};
