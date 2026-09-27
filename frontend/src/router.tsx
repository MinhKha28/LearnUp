import { createBrowserRouter } from "react-router-dom";

import Layout from "@/layout";

import HomePage from "@/pages/guest/home";
import LoginPage from "@/pages/guest/login";
import RegisterPage from "@/pages/guest/register";
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

export const router = createBrowserRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <HomePage />,
      },
      { path: "register/:screen?", element: <RegisterPage /> },
    ],
  },
  {
    path: "/admin",
    element: <LayoutAdmin />,
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
    children: [
      { index: true, element: <OrganizerDashboard /> },
      { path: "subscription", element: <OrganizerSubscription /> },
      { path: "subscription/renew", element: <OrganizerSubscriptionRenew /> },
      { path: "subscription/upgrade", element: <OrganizerSubscriptionUpgrade /> },
      { path: "organization", element: <OrganizerOrganization /> },
      { path: "organization/edit", element: <OrganizerOrganizationEdit /> },
      { path: "instructors", element: <OrganizerInstructors /> },
      { path: "instructors/add", element: <OrganizerInstructorCreate /> },
      { path: "instructors/import", element: <OrganizerInstructorImport /> },
      { path: "instructors/:instructorId", element: <OrganizerInstructorDetail /> },
      { path: "learners", element: <OrganizerLearners /> },
      { path: "learners/add", element: <OrganizerLearnerCreate /> },
      { path: "learners/import", element: <OrganizerLearnerImport /> },
      { path: "learners/:learnerId", element: <OrganizerLearnerDetail /> },
      { path: "learners/:learnerId/report", element: <OrganizerLearnerReport /> },
      { path: "courses", element: <OrganizerCourses /> },
      { path: "courses/approvals", element: <OrganizerCourseApprovals /> },
      { path: "courses/:courseId/review", element: <OrganizerCourseReview /> },
      { path: "courses/:courseId/version-report", element: <OrganizerCourseVersionReport /> },
      { path: "courses/:courseId", element: <OrganizerCourseDetail /> },
      { path: "assignments", element: <OrganizerAssignments /> },
      { path: "assignments/assign", element: <OrganizerAssignmentCreate /> },
      { path: "assignments/:assignmentId", element: <OrganizerAssignmentDetail /> },
      { path: "reports", element: <OrganizerReports /> },
      { path: "reports/:reportId", element: <OrganizerReportDetail /> },
      { path: "evaluations", element: <OrganizerEvaluations /> },
      { path: "content-reports", element: <OrganizerContentReports /> },
      { path: "content-reports/:reportId", element: <OrganizerContentReportDetail /> },
      { path: "violation-history", element: <OrganizerViolationHistory /> },
      { path: "profile", element: <OrganizerProfile /> },
      { path: "profile/change-password", element: <OrganizerChangePassword /> },
    ],
  },
  {
    path: "/login",
    element: <LoginPage />,
  },
]);
