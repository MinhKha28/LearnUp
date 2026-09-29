import { useEffect, useState } from "react";
import { Button, Drawer } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { Link, useLocation } from "react-router-dom";
import "@/components/layout/header.scss";

const navItems = [
  { key: "platform", label: "Platform", hash: "#platform" },
  { key: "how-it-works", label: "How it works", hash: "#how-it-works" },
  { key: "plans", label: "Plans", hash: "#plans" },
  { key: "faq", label: "FAQ", hash: "#before-you-start" },
];

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const home = pathname === "/";
  const registration = pathname.startsWith("/register");
  const bareAuthFlow =
    pathname.startsWith("/activate") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password");
  const plansActive =
    pathname === "/register" || pathname === "/register/no-plans";
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
      <Link className="header-signin" to="/login" onClick={closeMenu}>
        Sign in
      </Link>
      {!home && (
        <Link className="header-action" to="/register" onClick={closeMenu}>
          Explore plans <span aria-hidden="true">{"→"}</span>
        </Link>
      )}
    </>
  );

  return (
    <header
      className={`header${home ? " header-home" : ""}${registration ? " header-registration" : ""}`}
    >
      <a className="header-skip" href="#guest-main">
        Skip to content
      </a>
      <Link className="header-logo" to="/" aria-label="LearnUP home">
        <img src="/logo/learnup-logo-dark.png" alt="LearnUP" />
      </Link>
      <nav className="header-nav" aria-label="Main navigation">
        {navigation}
      </nav>
      <Button
        className="header-menu"
        icon={<MenuOutlined />}
        aria-label="Open navigation"
        onClick={() => setOpen(true)}
      />
      <Drawer title="LearnUP" open={open} onClose={closeMenu} width={300}>
        <nav className="header-mobile" aria-label="Mobile navigation">
          {navigation}
        </nav>
      </Drawer>
    </header>
  );
}
