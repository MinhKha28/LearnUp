import {
  AppstoreOutlined,
  FlagOutlined,
  GoldOutlined,
  LogoutOutlined,
  MenuOutlined,
  SwapOutlined,
  TableOutlined,
  UnorderedListOutlined,
} from "@ant-design/icons";
import { Avatar, Button, Drawer, Layout, Menu, Modal, type MenuProps } from "antd";
import { useMemo, useState } from "react";
import { Link, Outlet, useLocation, useNavigate } from "react-router-dom";

import { useCurrentApp } from "@/components/context/app.context";
import { useSignOut } from "@/hooks/use.sign.out";
import NotificationBell from "@/components/notification/notification.bell";
import { useDevIdentity } from "@/hooks/use.dev.identity";
import { DevIdentitySelect } from "@/components/learner/dev.identity.switcher";
import "./layout.learner.scss";

type MenuItem = Required<MenuProps>["items"][number];

const learnerMenuItems: MenuItem[] = [
  { key: "/learner", icon: <TableOutlined />, label: "Tổng quan" },
  { key: "/learner/courses", icon: <UnorderedListOutlined />, label: "Khóa học của tôi" },
  { key: "/learner/catalog", icon: <AppstoreOutlined />, label: "Danh mục Khóa học" },
  { key: "/learner/peer-review", icon: <SwapOutlined />, label: "Chấm chéo" },
  { key: "/learner/certificates", icon: <GoldOutlined />, label: "Chứng chỉ" },
  { key: "/learner/reports", icon: <FlagOutlined />, label: "Báo cáo của tôi" },
];

const LayoutLearner = () => {
  const { user } = useCurrentApp();
  const demoIdentity = useDevIdentity();
  const location = useLocation();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const selectedKey = useMemo(() => {
    if (location.pathname.startsWith("/learner/courses")) return "/learner/courses";
    if (location.pathname.startsWith("/learner/catalog")) return "/learner/catalog";
    if (location.pathname.startsWith("/learner/peer-review")) return "/learner/peer-review";
    if (location.pathname.startsWith("/learner/certificates")) return "/learner/certificates";
    if (location.pathname.startsWith("/learner/reports")) return "/learner/reports";
    if (location.pathname.startsWith("/learner/profile")) return "/learner/profile";
    return "/learner";
  }, [location.pathname]);

  const displayName = demoIdentity?.current.label || user?.fullName || "Học viên";
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
      <Link className="learner-brand" to="/learner" aria-label="Trang chủ học viên LearnUP">
        <img src="/logo/learnup-logo-dark.png" alt="LearnUP" />
      </Link>
      <span className="learner-nav-caption">Không gian học viên</span>
      <Menu
        className="learner-navigation"
        mode="inline"
        selectedKeys={[selectedKey]}
        items={learnerMenuItems}
        onClick={goTo}
      />
      <div className="learner-sidebar-user">
        <div className="learner-user-row">
          <Avatar size={34} src={user?.avatar}>{initials}</Avatar>
          <div className="learner-user-info">
            <strong>{displayName}</strong>
            <small>{demoIdentity?.current.roleLabel ?? "Học viên"}</small>
          </div>
          <Button
            className="learner-signout-trigger"
            type="text"
            icon={<LogoutOutlined />}
            aria-label="Đăng xuất"
            onClick={() => setSignOutOpen(true)}
          />
        </div>
        <Link className="learner-account-settings" to="/learner/profile">
          Cài đặt tài khoản
        </Link>
      </div>
    </>
  );

  return (
    <Layout className="learner-layout">
      <Layout.Sider className="learner-sidebar" width={240} theme="light">
        {navigation}
      </Layout.Sider>
      <Drawer
        className="learner-mobile-drawer"
        placement="left"
        width={260}
        open={mobileOpen}
        onClose={() => setMobileOpen(false)}
        closable={false}
      >
        {navigation}
      </Drawer>
      <Layout className="learner-workspace">
        <Layout.Header className="learner-topbar">
          <div className="learner-topbar-left">
            <Button
              className="learner-menu-trigger"
              type="text"
              icon={<MenuOutlined />}
              onClick={() => setMobileOpen(true)}
              aria-label="Mở điều hướng"
            />
            <span className="learner-org-name">{demoIdentity?.current.organizationLabel ?? "Demo Organization"}</span>
          </div>
          <div className="learner-topbar-actions">
            <DevIdentitySelect identity={demoIdentity} />
            <NotificationBell basePath="/learner" />
            <div className="learner-topbar-user">
              <Avatar size={30} src={user?.avatar} className="learner-topbar-avatar">{initials}</Avatar>
              {demoIdentity && <span><strong>{displayName}</strong><small>{demoIdentity.current.roleLabel}</small></span>}
            </div>
          </div>
        </Layout.Header>
        <Layout.Content className="learner-main">
          <Outlet />
        </Layout.Content>
      </Layout>
      <Modal
        className="learner-signout-modal"
        open={signOutOpen}
        onCancel={() => setSignOutOpen(false)}
        footer={null}
        closable={false}
        centered
        width={420}
      >
        <h3>Đăng xuất khỏi LearnUP?</h3>
        <p>Phiên hiện tại của bạn trên thiết bị này sẽ kết thúc.</p>
        <div className="learner-signout-actions">
          <Button onClick={() => setSignOutOpen(false)}>Tiếp tục đăng nhập</Button>
          <Button type="primary" onClick={signOut}>
            Đăng xuất
          </Button>
        </div>
      </Modal>
    </Layout>
  );
};

export default LayoutLearner;
