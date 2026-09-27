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
    path: "/login",
    element: <LoginPage />,
  },
]);
