import { useState } from "react";
import { Button, Drawer } from "antd";
import { MenuOutlined } from "@ant-design/icons";
import { Link, useLocation } from "react-router-dom";
import "@/components/layout/header.scss";

export default function Header() {
  const [open, setOpen] = useState(false);
  const { pathname } = useLocation();
  const home = pathname === "/";
  const registration = pathname.startsWith("/register");
  const plansActive =
    pathname === "/register" || pathname === "/register/no-plans";
  const closeMenu = () => setOpen(false);

  const navigation = (
    <>
      <a
        className={home ? "header-active" : undefined}
        href="/#platform"
        onClick={closeMenu}
      >
        Platform
      </a>
      <a href="/#how-it-works" onClick={closeMenu}>
        How it works
      </a>
      <a
        className={plansActive ? "header-active" : undefined}
        href="/#plans"
        onClick={closeMenu}
      >
        Plans
      </a>
      <a href="/#before-you-start" onClick={closeMenu}>
        FAQ
      </a>
      <Link className="header-signin" to="/login" onClick={closeMenu}>
        Sign in
      </Link>
      {!home && (
        <Link className="header-action" to="/register" onClick={closeMenu}>
          Explore plans <span aria-hidden="true">{"\u2192"}</span>
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
