import {
  CompassOutlined,
  FileDoneOutlined,
  LogoutOutlined,
  MenuOutlined,
  StarOutlined,
  SwapOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Drawer, Layout, Menu, Modal, type MenuProps } from "antd";
import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import NotificationBell from "@/components/notification/notification.bell";
import { useCurrentApp } from "@/components/context/app.context";
import { useSignOut } from "@/hooks/use.sign.out";
import "./layout.instructor.scss";

type MenuItem = Required<MenuProps>["items"][number];

const instructorMenuItems: MenuItem[] = [
  { key: "/instructor", icon: <TableOutlined />, label: "Tổng quan" },
  { key: "/instructor/courses", icon: <UnorderedListOutlined />, label: "Khóa học của tôi" },
  { key: "/instructor/submissions", icon: <FileDoneOutlined />, label: "Bài nộp" },
  { key: "/instructor/peer-cycles", icon: <SwapOutlined />, label: "Chu kỳ chấm chéo" },
  { key: "/instructor/monitoring", icon: <CompassOutlined />, label: "Theo dõi học tập" },
  { key: "/instructor/evaluations", icon: <StarOutlined />, label: "Đánh giá khóa học" },
];

const LayoutInstructor = () => {
  const { user } = useCurrentApp();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/instructor/courses")) return "/instructor/courses";
    if (location.pathname.startsWith("/instructor/submissions")) return "/instructor/submissions";
    if (location.pathname.startsWith("/instructor/peer-cycles")) return "/instructor/peer-cycles";
    if (location.pathname.startsWith("/instructor/monitoring")) return "/instructor/monitoring";
    if (location.pathname.startsWith("/instructor/evaluations")) return "/instructor/evaluations";
    if (location.pathname.startsWith("/instructor/profile")) return "/instructor/profile";
    return "/instructor";
  }, [location.pathname]);

  const displayName = user?.fullName || "Giảng viên";
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

  // UC06: đóng hộp thoại, thu hồi refresh token ở identity rồi xóa phiên trên trình duyệt
  const signOutRequest = useSignOut();
  const signOut = async () => {
    setSignOutOpen(false);
    await signOutRequest();
  };

  const navigation = (
    <>
      <Link className="instructor-brand" to="/instructor" aria-label="Trang chủ giảng viên LearnUP">
        <img src="/logo/learnup-logo-dark.png" alt="LearnUP" />
      </Link>
      <span className="instructor-nav-caption">Không gian giảng viên</span>
      <Menu
        className="instructor-navigation"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={instructorMenuItems}
        onClick={goTo}
      />
      <div className="instructor-sidebar-user">
        <div className="instructor-user-row">
          <Avatar size={34} src={user?.avatar}>{initials}</Avatar>
          <div className="instructor-user-info">
            <strong>{displayName}</strong>
            <small>Giảng viên</small>
          </div>
          <Button
            className="instructor-signout-trigger"
            type="text"
            icon={<LogoutOutlined />}
            aria-label="Đăng xuất"
            onClick={() => setSignOutOpen(true)}
          />
        </div>
        <Link className="instructor-account-settings" to="/instructor/profile">
          Cài đặt tài khoản
        </Link>
      </div>
    </>
  );

  return (
    <Layout className="instructor-layout">
      <Layout.Sider className="instructor-sidebar" width={240} theme="light">
        {navigation}
      </Layout.Sider>
      <Drawer
        className="instructor-mobile-drawer"
        placement="left"
        width={260}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        closable={false}
      >
        {navigation}
      </Drawer>
      <Layout className="instructor-workspace">
        <Layout.Header className="instructor-topbar">
          <div className="instructor-topbar-left">
            <Button
              className="instructor-menu-trigger"
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileOpen(true)}
              aria-label="Mở menu điều hướng"
            />
            {user?.organizationName && (
              <span className="instructor-org-name">{user.organizationName}</span>
            )}
          </div>
          <div className="instructor-topbar-actions">
            <NotificationBell basePath="/instructor" />
            <Avatar size={30} src={user?.avatar} className="instructor-topbar-avatar">
              {initials}
            </Avatar>
          </div>
        </Layout.Header>
        <Layout.Content className="instructor-main">
          <Outlet />
        </Layout.Content>
      </Layout>
      <Modal
        className="instructor-signout-modal"
        open={signOutOpen}
        onCancel={() => setSignOutOpen(false)}
        footer={null}
        closable={false}
        centered
        width={420}
      >
        <h3>Đăng xuất khỏi LearnUP?</h3>
        <p>Phiên đăng nhập giảng viên trên thiết bị này sẽ kết thúc.</p>
        <div className="instructor-signout-actions">
          <Button onClick={() => setSignOutOpen(false)}>Tiếp tục đăng nhập</Button>
          <Button type="primary" onClick={signOut}>
            Đăng xuất
          </Button>
        </div>
      </Modal>
    </Layout>
  );
};

export default LayoutInstructor;
