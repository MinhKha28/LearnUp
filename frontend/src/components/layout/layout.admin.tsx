import {
  BarChartOutlined,
  BellOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  ExclamationCircleOutlined,
  LockOutlined,
  LogoutOutlined,
  MenuOutlined,
  SafetyCertificateOutlined,
  SettingOutlined,
  StopOutlined,
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
import "./layout.admin.scss";

type MenuItem = Required<MenuProps>["items"][number];

const adminMenuItems: MenuItem[] = [
  {
    type: "group",
    label: "OVERVIEW",
    children: [
      { key: "/admin", icon: <DashboardOutlined />, label: "Dashboard" },
    ],
  },
  {
    type: "group",
    label: "PLATFORM",
    children: [
      {
        key: "/admin/organizations",
        icon: <TeamOutlined />,
        label: "Organizations",
      },
      { key: "/admin/plans", icon: <CreditCardOutlined />, label: "Plans" },
      {
        key: "/admin/configuration",
        icon: <SettingOutlined />,
        label: "Configuration",
      },
      {
        key: "/admin/statistics",
        icon: <BarChartOutlined />,
        label: "Platform statistics",
      },
    ],
  },
  {
    type: "group",
    label: "MODERATION",
    children: [
      {
        key: "/admin/reports",
        icon: <ExclamationCircleOutlined />,
        label: (
          <span className="admin-menu-label">
            Escalated Reports <Badge count={2} />
          </span>
        ),
      },
      {
        key: "/admin/suspended-organizations",
        icon: <StopOutlined />,
        label: (
          <span className="admin-menu-label">
            Suspended Organizations <Badge count={2} />
          </span>
        ),
      },
    ],
  },
  {
    type: "group",
    label: "ACCOUNT",
    children: [
      { key: "/admin/profile", icon: <UserOutlined />, label: "Profile" },
    ],
  },
];

const getPageMeta = (pathname: string) => {
  if (pathname === "/admin") return ["PLATFORM ADMIN", "Overview"];
  if (pathname.includes("replace-organizer"))
    return ["PLATFORM ADMIN", "Replace Organizer"];
  if (pathname.includes("organizations/") && !pathname.includes("suspended"))
    return ["PLATFORM ADMIN", "Organization detail"];
  if (pathname.endsWith("plans/create"))
    return ["PLATFORM ADMIN", "Create plan"];
  if (pathname.includes("plans/") && pathname.endsWith("edit"))
    return ["PLATFORM ADMIN", "Edit plan"];
  if (pathname === "/admin/plans") return ["PLATFORM ADMIN", "Plans"];
  if (pathname.includes("reports/")) return ["PLATFORM ADMIN", "Report detail"];
  if (pathname === "/admin/reports")
    return ["PLATFORM ADMIN", "Escalated Reports"];
  if (pathname === "/admin/configuration")
    return ["PLATFORM ADMIN", "Configuration"];
  if (pathname === "/admin/statistics")
    return ["PLATFORM ADMIN", "Platform statistics"];
  if (pathname === "/admin/suspended-organizations")
    return ["PLATFORM ADMIN", "Suspended Organizations"];
  if (pathname === "/admin/profile/change-password")
    return ["PLATFORM ADMIN", "Change password"];
  if (pathname === "/admin/profile") return ["PLATFORM ADMIN", "Profile"];
  return ["PLATFORM ADMIN", "Organizations"];
};

const LayoutAdmin = () => {
  const { user, setUser, setIsAuthenticated } = useCurrentApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [eyebrow, pageLabel] = getPageMeta(location.pathname);
  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/admin/organizations"))
      return "/admin/organizations";
    if (location.pathname.startsWith("/admin/plans")) return "/admin/plans";
    if (location.pathname.startsWith("/admin/reports")) return "/admin/reports";
    if (location.pathname.startsWith("/admin/profile")) return "/admin/profile";
    return location.pathname;
  }, [location.pathname]);

  const displayName = user?.fullName || "Rufus Lee";
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
      label: <Link to="/admin/profile">Profile</Link>,
    },
    {
      key: "password",
      icon: <LockOutlined />,
      label: <Link to="/admin/profile/change-password">Change password</Link>,
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
      <Link className="admin-brand" to="/admin" aria-label="LearnUP Admin home">
        <span className="admin-brand-mark">
          <SafetyCertificateOutlined />
        </span>
        <img src="/logo/learnup-logo-dark.png" alt="LearnUP" />
      </Link>
      <Menu
        className="admin-navigation"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={adminMenuItems}
        onClick={goTo}
      />
    </>
  );

  return (
    <Layout className="admin-layout">
      <Layout.Sider className="admin-sidebar" width={240} theme="light">
        {navigation}
      </Layout.Sider>
      <Drawer
        className="admin-mobile-drawer"
        placement="left"
        width={260}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        closable={false}
      >
        {navigation}
      </Drawer>
      <Layout className="admin-workspace">
        <Layout.Header className="admin-topbar">
          <div className="admin-topbar-left">
            <Button
              className="admin-menu-trigger"
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileOpen(true)}
              aria-label="Open navigation"
            />
            <div>
              <span className="admin-topbar-eyebrow">{eyebrow}</span>
              <strong>{pageLabel}</strong>
            </div>
          </div>
          <div className="admin-topbar-actions">
            <span className="admin-demo-badge">Demo data</span>
            <Button
              className="admin-notification"
              type="text"
              icon={<BellOutlined />}
              aria-label="Notifications"
            />
            <Dropdown
              menu={{ items: profileItems }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <button className="admin-user" type="button">
                <Avatar size={34}>{initials}</Avatar>
                <span>
                  <strong>{displayName}</strong>
                  <small>Platform Admin</small>
                </span>
              </button>
            </Dropdown>
          </div>
        </Layout.Header>
        <Layout.Content className="admin-main">
          <Outlet />
        </Layout.Content>
        <Layout.Footer className="admin-footer">
          <span>LearnUP</span>
          <span>Platform Administration</span>
        </Layout.Footer>
      </Layout>
    </Layout>
  );
};

export default LayoutAdmin;
