import {
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
  BellOutlined,
  BookOutlined,
  CarryOutOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  FlagOutlined,
  LockOutlined,
  LogoutOutlined,
  MenuOutlined,
  SafetyCertificateOutlined,
  SolutionOutlined,
  StarOutlined,
  TeamOutlined,
  UserOutlined,
} from "@ant-design/icons";
import {
  Avatar,
  Badge,
  Button,
  Drawer,
  Dropdown,
  Layout,
  Menu,
  type MenuProps,
} from "antd";
import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useCurrentApp } from "@/components/context/app.context";
import "./layout.organizer.scss";

type MenuItem = Required<MenuProps>["items"][number];

const organizerMenuItems: MenuItem[] = [
  {
    type: "group",
    label: "OVERVIEW",
    children: [
      { key: "/organizer", icon: <DashboardOutlined />, label: "Dashboard" },
    ],
  },
  {
    type: "group",
    label: "MANAGEMENT",
    children: [
      {
        key: "/organizer/subscription",
        icon: <CreditCardOutlined />,
        label: "Subscription",
      },
      {
        key: "/organizer/organization",
        icon: <BankOutlined />,
        label: "Organization",
      },
      {
        key: "/organizer/instructors",
        icon: <SolutionOutlined />,
        label: "Instructors",
      },
      {
        key: "/organizer/learners",
        icon: <TeamOutlined />,
        label: "Learners",
      },
    ],
  },
  {
    type: "group",
    label: "TRAINING",
    children: [
      { key: "/organizer/courses", icon: <BookOutlined />, label: "Courses" },
      {
        key: "/organizer/assignments",
        icon: <CarryOutOutlined />,
        label: "Assignments",
      },
    ],
  },
  {
    type: "group",
    label: "INSIGHTS",
    children: [
      {
        key: "/organizer/reports",
        icon: <BarChartOutlined />,
        label: "Reports",
      },
      {
        key: "/organizer/evaluations",
        icon: <StarOutlined />,
        label: "Evaluations",
      },
    ],
  },
  {
    type: "group",
    label: "MODERATION",
    children: [
      {
        key: "/organizer/content-reports",
        icon: <FlagOutlined />,
        label: (
          <span className="organizer-menu-label">
            Content Reports <Badge count={7} />
          </span>
        ),
      },
      {
        key: "/organizer/violation-history",
        icon: <AuditOutlined />,
        label: "Violation History",
      },
    ],
  },
  {
    type: "group",
    label: "ACCOUNT",
    children: [
      { key: "/organizer/profile", icon: <UserOutlined />, label: "Profile" },
    ],
  },
];

const getPageMeta = (pathname: string) => {
  if (pathname === "/organizer") return ["ORGANIZER", "Dashboard"];
  if (pathname === "/organizer/subscription")
    return ["ORGANIZER", "Subscription"];
  if (pathname === "/organizer/subscription/renew")
    return ["ORGANIZER", "Renew subscription"];
  if (pathname === "/organizer/subscription/upgrade")
    return ["ORGANIZER", "Upgrade subscription"];
  if (pathname === "/organizer/organization/edit")
    return ["ORGANIZER", "Edit organization"];
  if (pathname === "/organizer/organization")
    return ["ORGANIZER", "Organization"];
  if (pathname === "/organizer/instructors/add")
    return ["ORGANIZER", "Add instructor"];
  if (pathname === "/organizer/instructors/import")
    return ["ORGANIZER", "Import instructors"];
  if (pathname.includes("/organizer/instructors/"))
    return ["ORGANIZER", "Instructor detail"];
  if (pathname === "/organizer/instructors")
    return ["ORGANIZER", "Instructors"];
  if (pathname === "/organizer/learners/add")
    return ["ORGANIZER", "Add learner"];
  if (pathname === "/organizer/learners/import")
    return ["ORGANIZER", "Import learners"];
  if (pathname.startsWith("/organizer/learners/") && pathname.endsWith("/report"))
    return ["ORGANIZER", "Learner Report"];
  if (pathname.includes("/organizer/learners/"))
    return ["ORGANIZER", "Learner detail"];
  if (pathname === "/organizer/learners") return ["ORGANIZER", "Learners"];
  if (pathname === "/organizer/courses/approvals")
    return ["ORGANIZER", "Courses awaiting approval"];
  if (pathname.includes("/review"))
    return ["ORGANIZER", "Review course"];
  if (pathname.endsWith("/version-report"))
    return ["ORGANIZER", "Version Report"];
  if (pathname.includes("/organizer/courses/"))
    return ["ORGANIZER", "Course detail"];
  if (pathname === "/organizer/courses") return ["ORGANIZER", "Courses"];
  if (pathname === "/organizer/assignments/assign")
    return ["ORGANIZER", "Assign required course"];
  if (pathname.includes("/organizer/assignments/"))
    return ["ORGANIZER", "Assignment detail"];
  if (pathname === "/organizer/assignments")
    return ["ORGANIZER", "Assignments"];
  if (pathname.includes("/organizer/reports/"))
    return ["ORGANIZER", "Report detail"];
  if (pathname === "/organizer/reports") return ["ORGANIZER", "Reports"];
  if (pathname === "/organizer/evaluations")
    return ["ORGANIZER", "Evaluations"];
  if (pathname.includes("/organizer/content-reports/"))
    return ["ORGANIZER", "Content report detail"];
  if (pathname === "/organizer/content-reports")
    return ["ORGANIZER", "Content reports"];
  if (pathname === "/organizer/violation-history")
    return ["ORGANIZER", "Violation history"];
  if (pathname === "/organizer/profile/change-password")
    return ["ORGANIZER", "Change password"];
  if (pathname === "/organizer/profile") return ["ORGANIZER", "Profile"];
  return ["ORGANIZER", "Dashboard"];
};

const LayoutOrganizer = () => {
  const { user, setUser, setIsAuthenticated } = useCurrentApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [eyebrow, pageLabel] = getPageMeta(location.pathname);
  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/organizer/subscription"))
      return "/organizer/subscription";
    if (location.pathname.startsWith("/organizer/organization"))
      return "/organizer/organization";
    if (location.pathname.startsWith("/organizer/instructors"))
      return "/organizer/instructors";
    if (location.pathname.startsWith("/organizer/learners"))
      return "/organizer/learners";
    if (location.pathname.startsWith("/organizer/courses"))
      return "/organizer/courses";
    if (location.pathname.startsWith("/organizer/assignments"))
      return "/organizer/assignments";
    if (location.pathname.startsWith("/organizer/reports"))
      return "/organizer/reports";
    if (location.pathname.startsWith("/organizer/evaluations"))
      return "/organizer/evaluations";
    if (location.pathname.startsWith("/organizer/content-reports"))
      return "/organizer/content-reports";
    if (location.pathname.startsWith("/organizer/violation-history"))
      return "/organizer/violation-history";
    if (location.pathname.startsWith("/organizer/profile"))
      return "/organizer/profile";
    return location.pathname;
  }, [location.pathname]);

  const displayName = user?.fullName || "Mai Nguyen";
  const initials = displayName
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const goTo = ({ key }: { key: string }) => {
    navigate(key);
    setMobileOpen(false);
  };
  const logout = () => {
    localStorage.removeItem("access_token");
    setUser(null);
    setIsAuthenticated(false);
    navigate("/login");
  };
  const profileItems: MenuProps["items"] = [
    {
      key: "profile",
      icon: <UserOutlined />,
      label: <Link to="/organizer/profile">Profile</Link>,
    },
    {
      key: "password",
      icon: <LockOutlined />,
      label: (
        <Link to="/organizer/profile/change-password">Change password</Link>
      ),
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Sign out",
      danger: true,
      onClick: logout,
    },
  ];

  const navigation = (
    <>
      <Link
        className="organizer-brand"
        to="/organizer"
        aria-label="LearnUP Organizer home"
      >
        <span className="organizer-brand-mark">
          <SafetyCertificateOutlined />
        </span>
        <img src="/logo/learnup-logo-dark.png" alt="LearnUP" />
      </Link>
      <Menu
        className="organizer-navigation"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={organizerMenuItems}
        onClick={goTo}
      />
    </>
  );

  return (
    <Layout className="organizer-layout">
      <Layout.Sider className="organizer-sidebar" width={240} theme="light">
        {navigation}
      </Layout.Sider>
      <Drawer
        className="organizer-mobile-drawer"
        placement="left"
        width={260}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        closable={false}
      >
        {navigation}
      </Drawer>
      <Layout className="organizer-workspace">
        <Layout.Header className="organizer-topbar">
          <div className="organizer-topbar-left">
            <Button
              className="organizer-menu-trigger"
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            />
            <div>
              <span className="organizer-topbar-eyebrow">{eyebrow}</span>
              <strong>{pageLabel}</strong>
            </div>
          </div>
          <div className="organizer-topbar-actions">
            <span className="organizer-org-badge">Northstar Learning</span>
            <Button
              className="organizer-notification"
              type="text"
              icon={<BellOutlined />}
              aria-label="Notifications"
            />
            <Dropdown
              menu={{ items: profileItems }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <button className="organizer-user" type="button">
                <Avatar size={34}>{initials}</Avatar>
                <span>
                  <strong>{displayName}</strong>
                  <small>Organizer</small>
                </span>
              </button>
            </Dropdown>
          </div>
        </Layout.Header>
        <Layout.Content className="organizer-main">
          <Outlet />
        </Layout.Content>
        <Layout.Footer className="organizer-footer">
          <span>LearnUP</span>
          <span>Organization Management</span>
        </Layout.Footer>
      </Layout>
    </Layout>
  );
};

export default LayoutOrganizer;
