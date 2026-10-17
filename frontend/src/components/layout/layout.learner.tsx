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
import { DevIdentitySwitcher } from "@/components/learner/dev.identity.switcher";
import "./layout.learner.scss";

type MenuItem = Required<MenuProps>["items"][number];

const learnerMenuItems: MenuItem[] = [
  { key: "/learner", icon: <TableOutlined />, label: "Overview" },
  { key: "/learner/courses", icon: <UnorderedListOutlined />, label: "Course của tôi" },
  { key: "/learner/catalog", icon: <AppstoreOutlined />, label: "Danh mục Course" },
  { key: "/learner/peer-review", icon: <SwapOutlined />, label: "Peer Review" },
  { key: "/learner/certificates", icon: <GoldOutlined />, label: "Certificates" },
  { key: "/learner/reports", icon: <FlagOutlined />, label: "My Reports" },
];

const LayoutLearner = () => {
  const { user } = useCurrentApp();
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

  const displayName = user?.fullName || "Học viên";
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
      <Link className="learner-brand" to="/learner" aria-label="LearnUP Learner home">
        <img src="/logo/learnup-logo-dark.png" alt="LearnUP" />
      </Link>
      <span className="learner-nav-caption">LEARNER WORKSPACE</span>
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
            <small>Learner</small>
          </div>
          <Button
            className="learner-signout-trigger"
            type="text"
            icon={<LogoutOutlined />}
            aria-label="Sign out"
            onClick={() => setSignOutOpen(true)}
          />
        </div>
        <Link className="learner-account-settings" to="/learner/profile">
          Account settings
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
              aria-label="Open navigation"
            />
            <span className="learner-org-name">Demo Organization</span>
          </div>
          <div className="learner-topbar-actions">
            <DevIdentitySwitcher />
            <NotificationBell basePath="/learner" />
            <Avatar size={30} src={user?.avatar} className="learner-topbar-avatar">
              {initials}
            </Avatar>
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
        <h3>Sign out of LearnUP?</h3>
        <p>Your current session will end on this device.</p>
        <div className="learner-signout-actions">
          <Button onClick={() => setSignOutOpen(false)}>Stay signed in</Button>
          <Button type="primary" onClick={signOut}>
            Sign out
          </Button>
        </div>
      </Modal>
    </Layout>
  );
};

export default LayoutLearner;
