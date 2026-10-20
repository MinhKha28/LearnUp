import {
  AuditOutlined,
  BankOutlined,
  BarChartOutlined,
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

import { useDevIdentity } from "@/hooks/use.dev.identity";
import { DevIdentitySelect } from "@/components/learner/dev.identity.switcher";
import NotificationBell from "@/components/notification/notification.bell";
import { useCurrentApp } from "@/components/context/app.context";
import { useSignOut } from "@/hooks/use.sign.out";
import "./layout.organizer.scss";

type MenuItem = Required<MenuProps>["items"][number];

const organizerMenuItems: MenuItem[] = [
  {
    type: "group",
    label: "Tổng quan",
    children: [
      { key: "/organizer", icon: <DashboardOutlined />, label: "Tổng quan" },
    ],
  },
  {
    type: "group",
    label: "Quản lý",
    children: [
      {
        key: "/organizer/subscription",
        icon: <CreditCardOutlined />,
        label: "Gói dịch vụ",
      },
      {
        key: "/organizer/organization",
        icon: <BankOutlined />,
        label: "Tổ chức",
      },
      {
        key: "/organizer/instructors",
        icon: <SolutionOutlined />,
        label: "Giảng viên",
      },
      {
        key: "/organizer/learners",
        icon: <TeamOutlined />,
        label: "Học viên",
      },
    ],
  },
  {
    type: "group",
    label: "Đào tạo",
    children: [
      { key: "/organizer/courses", icon: <BookOutlined />, label: "Khóa học" },
      {
        key: "/organizer/assignments",
        icon: <CarryOutOutlined />,
        label: "Phân công đào tạo",
      },
    ],
  },
  {
    type: "group",
    label: "Thống kê",
    children: [
      {
        key: "/organizer/reports",
        icon: <BarChartOutlined />,
        label: "Báo cáo",
      },
      {
        key: "/organizer/evaluations",
        icon: <StarOutlined />,
        label: "Đánh giá",
      },
    ],
  },
  {
    type: "group",
    label: "Kiểm duyệt",
    children: [
      {
        key: "/organizer/content-reports",
        icon: <FlagOutlined />,
        label: (
          <span className="organizer-menu-label">
            Báo cáo nội dung <Badge count={7} />
          </span>
        ),
      },
      {
        key: "/organizer/violation-history",
        icon: <AuditOutlined />,
        label: "Lịch sử vi phạm",
      },
    ],
  },
  {
    type: "group",
    label: "Tài khoản",
    children: [
      { key: "/organizer/profile", icon: <UserOutlined />, label: "Hồ sơ" },
    ],
  },
];

const getPageMeta = (pathname: string) => {
  if (pathname === "/organizer") return ["Quản lý đào tạo", "Tổng quan"];
  if (pathname === "/organizer/subscription")
    return ["Quản lý đào tạo", "Gói dịch vụ"];
  if (pathname === "/organizer/subscription/renew")
    return ["Quản lý đào tạo", "Gia hạn gói dịch vụ"];
  if (pathname === "/organizer/subscription/upgrade")
    return ["Quản lý đào tạo", "Nâng cấp gói dịch vụ"];
  if (pathname === "/organizer/organization/edit")
    return ["Quản lý đào tạo", "Chỉnh sửa tổ chức"];
  if (pathname === "/organizer/organization")
    return ["Quản lý đào tạo", "Tổ chức"];
  if (pathname === "/organizer/instructors/add")
    return ["Quản lý đào tạo", "Thêm giảng viên"];
  if (pathname === "/organizer/instructors/import")
    return ["Quản lý đào tạo", "Nhập danh sách giảng viên"];
  if (pathname.startsWith("/organizer/instructors/") && pathname.endsWith("/edit"))
    return ["Quản lý đào tạo", "Chỉnh sửa giảng viên"];
  if (pathname.includes("/organizer/instructors/"))
    return ["Quản lý đào tạo", "Chi tiết giảng viên"];
  if (pathname === "/organizer/instructors")
    return ["Quản lý đào tạo", "Giảng viên"];
  if (pathname === "/organizer/learners/add")
    return ["Quản lý đào tạo", "Thêm học viên"];
  if (pathname === "/organizer/learners/import")
    return ["Quản lý đào tạo", "Nhập danh sách học viên"];
  if (pathname.startsWith("/organizer/learners/") && pathname.endsWith("/report"))
    return ["Quản lý đào tạo", "Báo cáo học viên"];
  if (pathname.includes("/organizer/learners/"))
    return ["Quản lý đào tạo", "Chi tiết học viên"];
  if (pathname === "/organizer/learners") return ["Quản lý đào tạo", "Học viên"];
  if (pathname === "/organizer/courses/approvals")
    return ["Quản lý đào tạo", "Khóa học chờ duyệt"];
  if (pathname.includes("/review"))
    return ["Quản lý đào tạo", "Duyệt khóa học"];
  if (pathname.endsWith("/version-report"))
    return ["Quản lý đào tạo", "Báo cáo phiên bản"];
  if (pathname.includes("/organizer/courses/"))
    return ["Quản lý đào tạo", "Chi tiết khóa học"];
  if (pathname === "/organizer/courses") return ["Quản lý đào tạo", "Khóa học"];
  if (pathname === "/organizer/assignments/assign")
    return ["Quản lý đào tạo", "Phân công khóa học bắt buộc"];
  if (pathname.includes("/organizer/assignments/"))
    return ["Quản lý đào tạo", "Chi tiết phân công"];
  if (pathname === "/organizer/assignments")
    return ["Quản lý đào tạo", "Phân công đào tạo"];
  if (pathname.includes("/organizer/reports/"))
    return ["Quản lý đào tạo", "Chi tiết báo cáo"];
  if (pathname === "/organizer/reports") return ["Quản lý đào tạo", "Báo cáo"];
  if (pathname === "/organizer/evaluations")
    return ["Quản lý đào tạo", "Đánh giá"];
  if (pathname.includes("/organizer/content-reports/"))
    return ["Quản lý đào tạo", "Chi tiết báo cáo nội dung"];
  if (pathname === "/organizer/content-reports")
    return ["Quản lý đào tạo", "Báo cáo nội dung"];
  if (pathname === "/organizer/violation-history")
    return ["Quản lý đào tạo", "Lịch sử vi phạm"];
  if (pathname === "/organizer/profile/change-password")
    return ["Quản lý đào tạo", "Đổi mật khẩu"];
  if (pathname === "/organizer/profile") return ["Quản lý đào tạo", "Hồ sơ"];
  return ["Quản lý đào tạo", "Tổng quan"];
};

const LayoutOrganizer = () => {
  const { user } = useCurrentApp();
  const demoIdentity = useDevIdentity();
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

  const displayName = demoIdentity?.current.label || user?.fullName || "Quản lý đào tạo";
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
      icon: <UserOutlined />,
      label: <Link to="/organizer/profile">Hồ sơ</Link>,
    },
    {
      key: "password",
      icon: <LockOutlined />,
      label: (
        <Link to="/organizer/profile/change-password">Đổi mật khẩu</Link>
      ),
    },
    { type: "divider" },
    {
      key: "logout",
      icon: <LogoutOutlined />,
      label: "Đăng xuất",
      danger: true,
      onClick: logout,
    },
  ];

  const navigation = (
    <>
      <Link
        className="organizer-brand"
        to="/organizer"
        aria-label="Trang chủ quản lý đào tạo LearnUP"
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
              aria-label="Mở điều hướng"
            />
            <div>
              <span className="organizer-topbar-eyebrow">{eyebrow}</span>
              <strong>{pageLabel}</strong>
            </div>
          </div>
          <div className="organizer-topbar-actions">
            <span className="organizer-org-badge">{demoIdentity?.current.organizationLabel ?? "Demo Organization"}</span>
            <DevIdentitySelect identity={demoIdentity} />
            <NotificationBell basePath="/organizer" />
            <Dropdown
              menu={{ items: profileItems }}
              trigger={["click"]}
              placement="bottomRight"
            >
              <button className="organizer-user" type="button">
                <Avatar size={34} src={user?.avatar}>{initials}</Avatar>
                <span>
                  <strong>{displayName}</strong>
                  <small>{demoIdentity?.current.roleLabel ?? "Quản lý đào tạo"}</small>
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
          <span>Quản lý tổ chức</span>
        </Layout.Footer>
      </Layout>
    </Layout>
  );
};

export default LayoutOrganizer;
