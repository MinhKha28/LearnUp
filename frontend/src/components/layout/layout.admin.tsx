import { previewPagesEnabled, visibleRoleMenu } from "@/utils/preview.pages";
import {
  BarChartOutlined,
  CreditCardOutlined,
  DashboardOutlined,
  ExclamationCircleOutlined,
  FileSearchOutlined,
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

import NotificationBell from "@/components/notification/notification.bell";
import { useCurrentApp } from "@/components/context/app.context";
import { useSignOut } from "@/hooks/use.sign.out";
import "./layout.admin.scss";

type MenuItem = Required<MenuProps>["items"][number];

const adminMenuItems: MenuItem[] = [
  {
    type: "group",
    label: "Điều hành",
    children: [
      { key: "/admin", icon: <DashboardOutlined aria-hidden="true" />, label: "Tổng quan nền tảng" },
    ],
  },
  {
    type: "group",
    label: "Nền tảng",
    children: [
      {
        key: "/admin/organizations",
        icon: <TeamOutlined aria-hidden="true" />,
        label: "Tổ chức",
      },
      { key: "/admin/plans", icon: <CreditCardOutlined aria-hidden="true" />, label: "Gói dịch vụ" },
      {
        key: "/admin/configuration",
        icon: <SettingOutlined aria-hidden="true" />,
        label: "Cấu hình",
      },
      {
        key: "/admin/statistics",
        icon: <BarChartOutlined aria-hidden="true" />,
        label: "Thống kê nền tảng",
      },
      {
        key: "/admin/audit-logs",
        icon: <FileSearchOutlined aria-hidden="true" />,
        label: "Nhật ký nền tảng",
      },
    ],
  },
  {
    type: "group",
    label: "Kiểm duyệt",
    children: [
      {
        key: "/admin/reports",
        icon: <ExclamationCircleOutlined aria-hidden="true" />,
        label: (
          <span className="admin-menu-label">
            Báo cáo chuyển cấp <Badge count={2} />
          </span>
        ),
      },
      {
        key: "/admin/suspended-organizations",
        icon: <StopOutlined aria-hidden="true" />,
        label: (
          <span className="admin-menu-label">
            Tổ chức bị tạm khóa <Badge count={2} />
          </span>
        ),
      },
    ],
  },
  {
    type: "group",
    label: "Tài khoản",
    children: [
      { key: "/admin/profile", icon: <UserOutlined aria-hidden="true" />, label: "Hồ sơ" },
    ],
  },
];

const visibleAdminMenuItems = visibleRoleMenu(adminMenuItems);

const getPageMeta = (pathname: string) => {
  if (pathname === "/admin") return ["Quản trị nền tảng", "Tổng quan nền tảng"];
  if (pathname.includes("replace-organizer"))
    return ["Quản trị nền tảng", "Thay quản lý đào tạo"];
  if (pathname.includes("organizations/") && !pathname.includes("suspended"))
    return ["Quản trị nền tảng", "Chi tiết tổ chức"];
  if (pathname.endsWith("plans/create"))
    return ["Quản trị nền tảng", "Tạo gói dịch vụ"];
  if (pathname.includes("plans/") && pathname.endsWith("edit"))
    return ["Quản trị nền tảng", "Sửa gói dịch vụ"];
  if (pathname === "/admin/notifications") return ["Quản trị nền tảng", "Thông báo"];
  if (pathname === "/admin/plans") return ["Quản trị nền tảng", "Gói dịch vụ"];
  if (pathname.includes("reports/")) return ["Quản trị nền tảng", "Chi tiết báo cáo"];
  if (pathname === "/admin/reports")
    return ["Quản trị nền tảng", "Báo cáo đã chuyển cấp xử lý"];
  if (pathname === "/admin/configuration")
    return ["Quản trị nền tảng", "Cấu hình"];
  if (pathname === "/admin/statistics")
    return ["Quản trị nền tảng", "Thống kê nền tảng"];
  if (pathname === "/admin/audit-logs")
    return ["Quản trị nền tảng", "Nhật ký nền tảng"];
  if (pathname === "/admin/suspended-organizations")
    return ["Quản trị nền tảng", "Tổ chức bị tạm khóa"];
  if (pathname === "/admin/profile/change-password")
    return ["Quản trị nền tảng", "Đổi mật khẩu"];
  if (pathname === "/admin/profile/edit") return ["Quản trị nền tảng", "Sửa hồ sơ"];
  if (pathname === "/admin/profile") return ["Quản trị nền tảng", "Hồ sơ"];
  return ["Quản trị nền tảng", "Tổ chức"];
};

const LayoutAdmin = () => {
  const { user } = useCurrentApp();
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

  const displayName = user?.fullName || "Quản trị viên";
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
  // UC06: thu hồi refresh token ở identity rồi xóa phiên trên trình duyệt
  const logout = useSignOut();
  const profileItems: MenuProps["items"] = [
    {
      key: "profile",
      icon: <UserOutlined aria-hidden="true" />,
      label: <Link to="/admin/profile">Hồ sơ</Link>,
    },
    {
      key: "password",
      icon: <LockOutlined aria-hidden="true" />,
      label: <Link to="/admin/profile/change-password">Đổi mật khẩu</Link>,
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined aria-hidden="true" />,
      label: "Đăng xuất",
      danger: true,
      onClick: logout,
    },
  ];

  const navigation = (
    <>
      <Link className="admin-brand" to="/admin" aria-label="Trang chủ Quản trị viên LearnUP">
        <span className="admin-brand-mark">
          <SafetyCertificateOutlined aria-hidden="true" />
        </span>
        <img src="/logo/learnup-logo-dark.png" alt="LearnUP" />
      </Link>
      <Menu
        className="admin-navigation"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={visibleAdminMenuItems}
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
              icon={<MenuOutlined aria-hidden="true" />}
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu điều hướng"
            />
            <div>
              <span className="admin-topbar-eyebrow">{eyebrow}</span>
              <strong>{pageLabel}</strong>
            </div>
          </div>
          <div className="admin-topbar-actions">
            {previewPagesEnabled && <span className="admin-demo-badge">Dữ liệu minh họa</span>}
            <NotificationBell basePath="/admin" />
            <Dropdown
              menu={{ items: profileItems }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <button className="admin-user" type="button">
                <Avatar size={34} src={user?.avatar}>{initials}</Avatar>
                <span>
                  <strong>{displayName}</strong>
                  <small>Quản trị viên nền tảng</small>
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
          <span>Quản trị nền tảng</span>
        </Layout.Footer>
      </Layout>
    </Layout>
  );
};

export default LayoutAdmin;
