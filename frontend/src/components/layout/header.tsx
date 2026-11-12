import { useEffect, useState } from "react";
import { Button, Drawer } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { Link, useLocation } from "react-router-dom";
import "@/components/layout/header.scss";
import { useCurrentApp } from "@/components/context/app.context";
import { homePathForRole } from "@/utils/auth";

const navItems = [
  { key: "platform", label: "Nền tảng", hash: "#platform" },
  { key: "how-it-works", label: "Cách sử dụng", hash: "#how-it-works" },
  { key: "plans", label: "Gói dịch vụ", hash: "#plans" },
  { key: "faq", label: "Câu hỏi thường gặp", hash: "#before-you-start" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const { isAuthenticated, user } = useCurrentApp();
  const home = pathname === "/";
  const registration = pathname.startsWith("/register");
  const bareAuthFlow =
    pathname.startsWith("/activate") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");
  const plansActive = registration;
  const [activeKey, setActiveKey] = useState("platform");
  const closeMenu = () => setOpen(false);

  useEffect(() => {
    if (plansActive) {
      setActiveKey("plans");
    } else if (home) {
      setActiveKey((prev) =>
        navItems.some((item) => item.key === prev) ? prev : "platform",
      );
    }
  }, [pathname, plansActive, home]);

  if (bareAuthFlow) return null;

  const navigation = (
    <>
      {navItems.map((item) => (
        <a
          key={item.key}
          className={activeKey === item.key ? "header-active" : undefined}
          href={`/${item.hash}`}
          onClick={() => {
            setActiveKey(item.key);
            closeMenu();
          }}
        >
          {item.label}
        </a>
      ))}
      {isAuthenticated && user ? (
        <Link
          className="header-signin"
          to={homePathForRole(user.role)}
          onClick={closeMenu}
        >
          Vào trang làm việc
        </Link>
      ) : (
        <Link className="header-signin" to="/login" onClick={closeMenu}>
          Đăng nhập
        </Link>
      )}

      {!home && (
        <Link className="header-action" to="/register" onClick={closeMenu}>
          Xem các gói dịch vụ <span aria-hidden="true">{"→"}</span>
        </Link>
      )}
    </>
  );

  return (
    <header
      className={`header${home ? " header-home" : ""}${registration ? " header-registration" : ""}`}
    >
      <a className="header-skip" href="#guest-main">
        Chuyển đến nội dung chính
      </a>
      <Link className="header-logo" to="/" aria-label="Trang chủ LearnUP">
        <img src="/logo/learnup-logo-dark.png" alt="LearnUP" />
      </Link>
      <nav className="header-nav" aria-label="Điều hướng chính">
        {navigation}
      </nav>
      <Button
        className="header-menu"
        icon={<MenuOutlined aria-hidden="true" />}
        aria-label="Mở menu điều hướng"
        onClick={() => setOpen(true)}
      />
      <Drawer title="LearnUP" open={open} onClose={closeMenu} width={300}>
        <nav className="header-mobile" aria-label="Điều hướng trên thiết bị di động">
          {navigation}
        </nav>
      </Drawer>
    </header>
  );
}
