import { createBrowserRouter } from "react-router-dom";

import Layout from "@/layout";

import NotFoundPage from "@/pages/error/not.found";
import ForbiddenPage from "@/pages/error/forbidden";
import ServerErrorPage from "@/pages/error/server.error";
import ServiceUnavailablePage from "@/pages/error/service.unavailable";

import HomePage from "@/pages/guest/home";
import LoginPage from "@/pages/guest/login";
import RegisterPage from "@/pages/guest/register";
import ActivatePage from "@/pages/guest/activate";
import ActivationSuccess from "@/pages/guest/activation.success";
import ForgotPasswordPage from "@/pages/guest/password.forgot";
import ResetPasswordPage from "@/pages/guest/password.reset";
import LayoutAdmin from "./components/layout/layout.admin";
import ManageDashboard from "./pages/admin/dashboard";
import Organizations from "./pages/admin/organizations";
import OrganizationDetail from "./pages/admin/organization.detail";
import ReplaceOrganizer from "./pages/admin/organizer.replace";
import Plans from "./pages/admin/plans";
import PlanForm from "./pages/admin/plan.form";
import Reports from "./pages/admin/reports";
import ReportDetail from "./pages/admin/report.detail";
import Configuration from "./pages/admin/configuration";
import Statistics from "./pages/admin/statistics";
import SuspendedOrganizations from "./pages/admin/suspended.organizations";
import Profile from "./pages/admin/profile";
import ChangePassword from "./pages/admin/password.change";
import LayoutOrganizer from "./components/layout/layout.organizer";
import OrganizerDashboard from "./pages/organizer/dashboard";
import OrganizerSubscription from "./pages/organizer/subscription";
import OrganizerSubscriptionRenew from "./pages/organizer/subscription.renew";
import OrganizerSubscriptionUpgrade from "./pages/organizer/subscription.upgrade";
import OrganizerOrganization from "./pages/organizer/organization";
import OrganizerOrganizationEdit from "./pages/organizer/organization.edit";
import OrganizerInstructors from "./pages/organizer/instructors";
import OrganizerInstructorDetail from "./pages/organizer/instructor.detail";
import OrganizerInstructorCreate from "./pages/organizer/instructor.create";
import OrganizerInstructorImport from "./pages/organizer/instructor.import";
import OrganizerLearners from "./pages/organizer/learners";
import OrganizerLearnerDetail from "./pages/organizer/learner.detail";
import OrganizerLearnerCreate from "./pages/organizer/learner.create";
import OrganizerLearnerImport from "./pages/organizer/learner.import";
import OrganizerLearnerReport from "./pages/organizer/learner.report";
import OrganizerCourses from "./pages/organizer/courses";
import OrganizerCourseApprovals from "./pages/organizer/course.approvals";
import OrganizerCourseReview from "./pages/organizer/course.review";
import OrganizerCourseDetail from "./pages/organizer/course.detail";
import OrganizerCourseVersionReport from "./pages/organizer/course.version.report";
import OrganizerAssignments from "./pages/organizer/assignments";
import OrganizerAssignmentCreate from "./pages/organizer/assignment.create";
import OrganizerAssignmentDetail from "./pages/organizer/assignment.detail";
import OrganizerReports from "./pages/organizer/reports";
import OrganizerReportDetail from "./pages/organizer/report.detail";
import OrganizerEvaluations from "./pages/organizer/evaluations";
import OrganizerContentReports from "./pages/organizer/content.reports";
import OrganizerContentReportDetail from "./pages/organizer/content.report.detail";
import OrganizerViolationHistory from "./pages/organizer/violation.history";
import OrganizerProfile from "./pages/organizer/profile";
import OrganizerChangePassword from "./pages/organizer/password.change";
import LayoutLearner from "./components/layout/layout.learner";
import LayoutLearnerCourse from "./components/layout/layout.learner.course";
import LearnerDashboard from "./pages/learner/dashboard";
import LearnerMyCourses from "./pages/learner/my.courses";
import LearnerCatalog from "./pages/learner/catalog";
import LearnerCourseOverview from "./pages/learner/course.overview";
import LearnerEnrollmentSuccess from "./pages/learner/enrollment.success";
import LearnerCourseCurriculum from "./pages/learner/course.curriculum";
import LearnerLessonDetail from "./pages/learner/lesson.detail";
import LearnerLessonResource from "./pages/learner/lesson.resource";
import LearnerCourseProgress from "./pages/learner/course.progress";
import LearnerCourseWithdraw from "./pages/learner/course.withdraw";
import LearnerCourseWithdrawn from "./pages/learner/course.withdrawn";
import LearnerCourseAssessments from "./pages/learner/course.assessments";
import LearnerQuizTake from "./pages/learner/quiz.take";
import LearnerQuizHistory from "./pages/learner/quiz.history";
import LearnerAssignmentDetail from "./pages/learner/assignment.detail";
import LearnerAssignmentSubmit from "./pages/learner/assignment.submit";
import LearnerAssignmentResubmit from "./pages/learner/assignment.resubmit";
import LearnerAssignmentSubmitted from "./pages/learner/assignment.submitted";
import LearnerPeerReviewQueue from "./pages/learner/peer.review.queue";
import LearnerPeerReviewForm from "./pages/learner/peer.review.form";
import LearnerPeerReviewHistory from "./pages/learner/peer.review.history";
import LearnerCertificates from "./pages/learner/certificates";
import LearnerCertificateDetail from "./pages/learner/certificate.detail";
import LearnerReportContent from "./pages/learner/report.content";
import LearnerReports from "./pages/learner/reports";
import LearnerReportEscalate from "./pages/learner/report.escalate";
import LearnerCourseEvaluation from "./pages/learner/course.evaluation";
import LearnerProfile from "./pages/learner/profile";
import LearnerProfileEdit from "./pages/learner/profile.edit";
import LearnerChangePassword from "./pages/learner/password.change";
import LearnerSubscriptionSuspended from "./pages/learner/subscription.suspended";
import LayoutInstructor from "./components/layout/layout.instructor";
import LayoutInstructorCourse from "./components/layout/layout.instructor.course";
import InstructorDashboard from "./pages/instructor/dashboard";
import InstructorMyCourses from "./pages/instructor/my.courses";
import InstructorCourseCreate from "./pages/instructor/course.create";
import InstructorCourseDetail from "./pages/instructor/course.detail";
import InstructorCourseQuotaBlocked from "./pages/instructor/course.quota.blocked";
import InstructorCourseEdit from "./pages/instructor/course.edit";
import InstructorCourseDraftCreated from "./pages/instructor/course.draft.created";
import InstructorCourseDeleteBlocked from "./pages/instructor/course.delete.blocked";
import InstructorCourseSubmit from "./pages/instructor/course.submit";
import InstructorCourseSubmitted from "./pages/instructor/course.submitted";
import InstructorCourseWithdraw from "./pages/instructor/course.withdraw";
import InstructorCourseVersions from "./pages/instructor/course.versions";
import InstructorCourseVersionCreate from "./pages/instructor/course.version.create";
import InstructorCourseBuilder from "./pages/instructor/course.builder";
import InstructorCourseBuilderNewVersion from "./pages/instructor/course.builder.new.version";
import InstructorCourseBuilderModuleAdd from "./pages/instructor/course.builder.module.add";
import InstructorCourseBuilderLessonAdd from "./pages/instructor/course.builder.lesson.add";
import InstructorCourseBuilderStructureEdit from "./pages/instructor/course.builder.structure.edit";
import InstructorCourseBuilderLessonDetail from "./pages/instructor/course.builder.lesson.detail";
import InstructorCourseBuilderLessonContentEdit from "./pages/instructor/course.builder.lesson.content.edit";
import InstructorCourseBuilderMaterials from "./pages/instructor/course.builder.materials";
import InstructorCourseBuilderVideoAdd from "./pages/instructor/course.builder.material.video.add";
import InstructorCourseBuilderReadingAdd from "./pages/instructor/course.builder.material.reading.add";
import InstructorCourseBuilderMaterialEdit from "./pages/instructor/course.builder.material.edit";
import InstructorCourseBuilderMaterialDeleteBlocked from "./pages/instructor/course.builder.material.delete.blocked";
import InstructorCourseBuilderModuleDelete from "./pages/instructor/course.builder.module.delete";
import InstructorCourseBuilderLessonDelete from "./pages/instructor/course.builder.lesson.delete";
import InstructorCourseBuilderMaterialDelete from "./pages/instructor/course.builder.material.delete";
import InstructorCourseBuilderQuizzes from "./pages/instructor/course.builder.quizzes";
import InstructorCourseBuilderQuizCreate from "./pages/instructor/course.builder.quiz.create";
import InstructorCourseBuilderQuizDetail from "./pages/instructor/course.builder.quiz.detail";
import InstructorCourseBuilderQuizConfigurationEdit from "./pages/instructor/course.builder.quiz.configuration.edit";
import InstructorCourseBuilderQuizQuestionEdit from "./pages/instructor/course.builder.quiz.question.edit";
import InstructorCourseBuilderQuizDelete from "./pages/instructor/course.builder.quiz.delete";
import InstructorCourseBuilderAssignments from "./pages/instructor/course.builder.assignments";
import InstructorCourseBuilderAssignmentCreate from "./pages/instructor/course.builder.assignment.create";
import InstructorCourseBuilderAssignmentRubricEdit from "./pages/instructor/course.builder.assignment.rubric.edit";
import InstructorCourseBuilderAssignmentPeerReviewEdit from "./pages/instructor/course.builder.assignment.peer.review.edit";
import InstructorCourseBuilderAssignmentDetail from "./pages/instructor/course.builder.assignment.detail";
import InstructorCourseBuilderAssignmentEdit from "./pages/instructor/course.builder.assignment.edit";
import InstructorCourseBuilderAssignmentDelete from "./pages/instructor/course.builder.assignment.delete";
import InstructorSubmissions from "./pages/instructor/submissions";
import InstructorSubmissionDetail from "./pages/instructor/submission.detail";
import InstructorSubmissionGrade from "./pages/instructor/submission.grade";
import InstructorSubmissionDiscrepancy from "./pages/instructor/submission.discrepancy";
import InstructorSubmissionFinalize from "./pages/instructor/submission.finalize";
import InstructorPeerCycles from "./pages/instructor/peer.cycles";
import InstructorPeerCycleDetail from "./pages/instructor/peer.cycle.detail";
import InstructorPeerCycleWaive from "./pages/instructor/peer.cycle.waive";
import InstructorMonitoring from "./pages/instructor/monitoring";
import InstructorMonitoringFilters from "./pages/instructor/monitoring.filters";
import InstructorMonitoringExport from "./pages/instructor/monitoring.export";
import InstructorLearnerProgress from "./pages/instructor/learner.progress";
import InstructorEvaluations from "./pages/instructor/evaluations";
import InstructorEvaluationComments from "./pages/instructor/evaluation.comments";
import InstructorEvaluationExport from "./pages/instructor/evaluation.export";
import InstructorCourseContentReview from "./pages/instructor/course.content.review";
import InstructorCourseContentReconsider from "./pages/instructor/course.content.reconsider";
import InstructorCourseContentEscalate from "./pages/instructor/course.content.escalate";
import InstructorProfile from "./pages/instructor/profile";
import InstructorProfileEdit from "./pages/instructor/profile.edit";
import InstructorChangePassword from "./pages/instructor/password.change";

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    errorElement: <ServerErrorPage />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      { path: "register/:screen?", element: <RegisterPage /> },
      { path: "activate/:token", element: <ActivatePage /> },
      { path: "activate/:token/success", element: <ActivationSuccess /> },
      { path: "forgot-password", element: <ForgotPasswordPage /> },
      { path: "reset-password/:token", element: <ResetPasswordPage /> },
    ],
  },
  {
    path: "/admin",
    element: <LayoutAdmin />,
    errorElement: <ServerErrorPage />,
    children: [
      { index: true, element: <ManageDashboard /> },
      { path: "organizations", element: <Organizations /> },
      {
        path: "organizations/:organizationId",
        element: <OrganizationDetail />,
      },
      {
        path: "organizations/:organizationId/replace-organizer",
        element: <ReplaceOrganizer />,
      },
      { path: "plans", element: <Plans /> },
      { path: "plans/create", element: <PlanForm mode="create" /> },
      { path: "plans/:planId/edit", element: <PlanForm mode="edit" /> },
      { path: "reports", element: <Reports /> },
      { path: "reports/:reportId", element: <ReportDetail /> },
      { path: "configuration", element: <Configuration /> },
      { path: "statistics", element: <Statistics /> },
      { path: "suspended-organizations", element: <SuspendedOrganizations /> },
      { path: "profile", element: <Profile /> },
      { path: "profile/change-password", element: <ChangePassword /> },
    ],
  },
  {
    path: "/organizer",
    element: <LayoutOrganizer />,
    errorElement: <ServerErrorPage />,
    children: [
      { index: true, element: <OrganizerDashboard /> },
      { path: "subscription", element: <OrganizerSubscription /> },
      { path: "subscription/renew", element: <OrganizerSubscriptionRenew /> },
      {
        path: "subscription/upgrade",
        element: <OrganizerSubscriptionUpgrade />,
      },
      { path: "organization", element: <OrganizerOrganization /> },
      { path: "organization/edit", element: <OrganizerOrganizationEdit /> },
      { path: "instructors", element: <OrganizerInstructors /> },
      { path: "instructors/add", element: <OrganizerInstructorCreate /> },
      { path: "instructors/import", element: <OrganizerInstructorImport /> },
      {
        path: "instructors/:instructorId",
        element: <OrganizerInstructorDetail />,
      },
      { path: "learners", element: <OrganizerLearners /> },
      { path: "learners/add", element: <OrganizerLearnerCreate /> },
      { path: "learners/import", element: <OrganizerLearnerImport /> },
      { path: "learners/:learnerId", element: <OrganizerLearnerDetail /> },
      {
        path: "learners/:learnerId/report",
        element: <OrganizerLearnerReport />,
      },
      { path: "courses", element: <OrganizerCourses /> },
      { path: "courses/approvals", element: <OrganizerCourseApprovals /> },
      { path: "courses/:courseId/review", element: <OrganizerCourseReview /> },
      {
        path: "courses/:courseId/version-report",
        element: <OrganizerCourseVersionReport />,
      },
      { path: "courses/:courseId", element: <OrganizerCourseDetail /> },
      { path: "assignments", element: <OrganizerAssignments /> },
      { path: "assignments/assign", element: <OrganizerAssignmentCreate /> },
      {
        path: "assignments/:assignmentId",
        element: <OrganizerAssignmentDetail />,
      },
      { path: "reports", element: <OrganizerReports /> },
      { path: "reports/:reportId", element: <OrganizerReportDetail /> },
      { path: "evaluations", element: <OrganizerEvaluations /> },
      { path: "content-reports", element: <OrganizerContentReports /> },
      {
        path: "content-reports/:reportId",
        element: <OrganizerContentReportDetail />,
      },
      { path: "violation-history", element: <OrganizerViolationHistory /> },
      { path: "profile", element: <OrganizerProfile /> },
      { path: "profile/change-password", element: <OrganizerChangePassword /> },
    ],
  },
  {
    path: "/learner",
    element: <LayoutLearner />,
    errorElement: <ServerErrorPage />,
    children: [
      { index: true, element: <LearnerDashboard /> },
      { path: "courses", element: <LearnerMyCourses /> },
      {
        path: "courses/:courseId/withdraw",
        element: <LearnerCourseWithdraw />,
      },
      {
        path: "courses/:courseId/withdrawn",
        element: <LearnerCourseWithdrawn />,
      },
      {
        path: "courses/:courseId/evaluation",
        element: <LearnerCourseEvaluation />,
      },
      {
        path: "courses/:courseId/lessons/:lessonId/resources/:resourceId/report",
        element: <LearnerReportContent />,
      },
      { path: "catalog", element: <LearnerCatalog /> },
      { path: "catalog/:courseId", element: <LearnerCourseOverview /> },
      {
        path: "catalog/:courseId/enrolled",
        element: <LearnerEnrollmentSuccess />,
      },
      {
        path: "catalog/:courseId/restored",
        element: <LearnerEnrollmentSuccess restored />,
      },
      { path: "peer-review", element: <LearnerPeerReviewQueue /> },
      { path: "peer-review/history", element: <LearnerPeerReviewHistory /> },
      { path: "peer-review/:submissionId", element: <LearnerPeerReviewForm /> },
      { path: "certificates", element: <LearnerCertificates /> },
      {
        path: "certificates/:certificateId",
        element: <LearnerCertificateDetail />,
      },
      { path: "reports", element: <LearnerReports /> },
      {
        path: "reports/:reportId/escalate",
        element: <LearnerReportEscalate />,
      },
      { path: "profile", element: <LearnerProfile /> },
      { path: "profile/edit", element: <LearnerProfileEdit /> },
      { path: "profile/change-password", element: <LearnerChangePassword /> },
    ],
  },
  {
    path: "/learner/courses/:courseId",
    element: <LayoutLearnerCourse />,
    errorElement: <ServerErrorPage />,
    children: [
      { index: true, element: <LearnerCourseCurriculum /> },
      { path: "progress", element: <LearnerCourseProgress /> },
      { path: "lessons/:lessonId", element: <LearnerLessonDetail /> },
      {
        path: "lessons/:lessonId/resources/:resourceId",
        element: <LearnerLessonResource />,
      },
      { path: "assessments", element: <LearnerCourseAssessments /> },
      { path: "quizzes/:quizId", element: <LearnerQuizTake /> },
      { path: "quizzes/:quizId/history", element: <LearnerQuizHistory /> },
      {
        path: "assignments/:assignmentId",
        element: <LearnerAssignmentDetail />,
      },
      {
        path: "assignments/:assignmentId/submit",
        element: <LearnerAssignmentSubmit />,
      },
      {
        path: "assignments/:assignmentId/resubmit",
        element: <LearnerAssignmentResubmit />,
      },
      {
        path: "assignments/:assignmentId/submitted",
        element: <LearnerAssignmentSubmitted />,
      },
    ],
  },
  {
    path: "/instructor",
    element: <LayoutInstructor />,
    errorElement: <ServerErrorPage />,
    children: [
      { index: true, element: <InstructorDashboard /> },
      { path: "courses", element: <InstructorMyCourses /> },
      { path: "courses/create", element: <InstructorCourseCreate /> },
      {
        path: "courses/create/quota-blocked",
        element: <InstructorCourseQuotaBlocked />,
      },
      {
        path: "courses/draft-created",
        element: <InstructorCourseDraftCreated />,
      },
      { path: "courses/:courseId", element: <InstructorCourseDetail /> },
      { path: "courses/:courseId/edit", element: <InstructorCourseEdit /> },
      {
        path: "courses/:courseId/delete-blocked",
        element: <InstructorCourseDeleteBlocked />,
      },
      { path: "courses/:courseId/submit", element: <InstructorCourseSubmit /> },
      {
        path: "courses/:courseId/submitted",
        element: <InstructorCourseSubmitted />,
      },
      {
        path: "courses/:courseId/withdraw",
        element: <InstructorCourseWithdraw />,
      },
      {
        path: "courses/:courseId/versions",
        element: <InstructorCourseVersions />,
      },
      {
        path: "courses/:courseId/versions/new",
        element: <InstructorCourseVersionCreate />,
      },
      { path: "submissions", element: <InstructorSubmissions /> },
      {
        path: "submissions/:submissionId",
        element: <InstructorSubmissionDetail />,
      },
      {
        path: "submissions/:submissionId/grade",
        element: <InstructorSubmissionGrade />,
      },
      {
        path: "submissions/:submissionId/discrepancy",
        element: <InstructorSubmissionDiscrepancy />,
      },
      {
        path: "submissions/:submissionId/finalize",
        element: <InstructorSubmissionFinalize />,
      },
      { path: "peer-cycles", element: <InstructorPeerCycles /> },
      { path: "peer-cycles/:cycleId", element: <InstructorPeerCycleDetail /> },
      {
        path: "peer-cycles/:cycleId/waive/:reviewerId",
        element: <InstructorPeerCycleWaive />,
      },
      { path: "monitoring", element: <InstructorMonitoring /> },
      { path: "monitoring/filters", element: <InstructorMonitoringFilters /> },
      { path: "monitoring/export", element: <InstructorMonitoringExport /> },
      {
        path: "monitoring/courses/:courseId/learners/:learnerId",
        element: <InstructorLearnerProgress />,
      },
      { path: "evaluations", element: <InstructorEvaluations /> },
      {
        path: "evaluations/comments",
        element: <InstructorEvaluationComments />,
      },
      { path: "evaluations/export", element: <InstructorEvaluationExport /> },
      {
        path: "courses/:courseId/content-review",
        element: <InstructorCourseContentReview />,
      },
      {
        path: "courses/:courseId/content-review/reconsider",
        element: <InstructorCourseContentReconsider />,
      },
      {
        path: "courses/:courseId/content-review/escalate",
        element: <InstructorCourseContentEscalate />,
      },
      { path: "profile", element: <InstructorProfile /> },
      { path: "profile/edit", element: <InstructorProfileEdit /> },
      {
        path: "profile/change-password",
        element: <InstructorChangePassword />,
      },
    ],
  },
  {
    path: "/instructor/courses/:courseId/builder",
    element: <LayoutInstructorCourse />,
    errorElement: <ServerErrorPage />,
    children: [
      { index: true, element: <InstructorCourseBuilder /> },
      { path: "new-version", element: <InstructorCourseBuilderNewVersion /> },
      { path: "modules/new", element: <InstructorCourseBuilderModuleAdd /> },
      {
        path: "modules/:moduleId/lessons/new",
        element: <InstructorCourseBuilderLessonAdd />,
      },
      {
        path: "modules/:moduleId/delete",
        element: <InstructorCourseBuilderModuleDelete />,
      },
      {
        path: "structure/edit",
        element: <InstructorCourseBuilderStructureEdit />,
      },
      {
        path: "lessons/:lessonId",
        element: <InstructorCourseBuilderLessonDetail />,
      },
      {
        path: "lessons/:lessonId/delete",
        element: <InstructorCourseBuilderLessonDelete />,
      },
      {
        path: "lessons/:lessonId/content/edit",
        element: <InstructorCourseBuilderLessonContentEdit />,
      },
      {
        path: "lessons/:lessonId/materials",
        element: <InstructorCourseBuilderMaterials />,
      },
      {
        path: "lessons/:lessonId/materials/video/new",
        element: <InstructorCourseBuilderVideoAdd />,
      },
      {
        path: "lessons/:lessonId/materials/reading/new",
        element: <InstructorCourseBuilderReadingAdd />,
      },
      {
        path: "lessons/:lessonId/materials/:materialId/edit",
        element: <InstructorCourseBuilderMaterialEdit />,
      },
      {
        path: "lessons/:lessonId/materials/:materialId/delete-blocked",
        element: <InstructorCourseBuilderMaterialDeleteBlocked />,
      },
      {
        path: "lessons/:lessonId/materials/:materialId/delete",
        element: <InstructorCourseBuilderMaterialDelete />,
      },
      { path: "quizzes", element: <InstructorCourseBuilderQuizzes /> },
      { path: "quizzes/new", element: <InstructorCourseBuilderQuizCreate /> },
      {
        path: "quizzes/:quizId",
        element: <InstructorCourseBuilderQuizDetail />,
      },
      {
        path: "quizzes/:quizId/edit",
        element: <InstructorCourseBuilderQuizConfigurationEdit />,
      },
      {
        path: "quizzes/:quizId/delete",
        element: <InstructorCourseBuilderQuizDelete />,
      },
      {
        path: "quizzes/:quizId/questions/new",
        element: <InstructorCourseBuilderQuizQuestionEdit />,
      },
      {
        path: "quizzes/:quizId/questions/:questionId/edit",
        element: <InstructorCourseBuilderQuizQuestionEdit />,
      },
      { path: "assignments", element: <InstructorCourseBuilderAssignments /> },
      {
        path: "assignments/new",
        element: <InstructorCourseBuilderAssignmentCreate />,
      },
      {
        path: "assignments/:assignmentId",
        element: <InstructorCourseBuilderAssignmentDetail />,
      },
      {
        path: "assignments/:assignmentId/edit",
        element: <InstructorCourseBuilderAssignmentEdit />,
      },
      {
        path: "assignments/:assignmentId/rubric",
        element: <InstructorCourseBuilderAssignmentRubricEdit />,
      },
      {
        path: "assignments/:assignmentId/peer-review",
        element: <InstructorCourseBuilderAssignmentPeerReviewEdit />,
      },
      {
        path: "assignments/:assignmentId/delete",
        element: <InstructorCourseBuilderAssignmentDelete />,
      },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
  {
    path: "/learner/subscription-suspended",
    element: <LearnerSubscriptionSuspended />,
  },
  { path: "/403", element: <ForbiddenPage /> },
  { path: "/500", element: <ServerErrorPage /> },
  { path: "/503", element: <ServiceUnavailablePage /> },
  { path: "*", element: <NotFoundPage /> },
]);
