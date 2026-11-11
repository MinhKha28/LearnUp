import { Link, useLocation } from "react-router-dom";
import "@/components/layout/footer.scss";

export default function Footer() {
  const { pathname } = useLocation();

  if (
    pathname.startsWith("/activate") ||
    pathname.startsWith("/forgot-password") ||
    pathname.startsWith("/reset-password")
  ) {
    return null;
  }

  if (pathname.startsWith("/register")) {
    return (
      <footer className="footer-compact">
        <span>{"\u00A9"} LearnUP</span>
        <span>Quản lý đào tạo cho tổ chức</span>
      </footer>
    );
  }

  return (
    <footer className="footer">
      <div className="footer-columns">
        <div className="footer-brand">
          <Link className="footer-logo" to="/">
            <img src="/logo/learnup-logo-light.png" alt="LearnUP" />
          </Link>
          <p>
            Quản lý hoạt động đào tạo, Khóa học và tiến độ
            <br />
            trên một trang làm việc chung của tổ chức.
          </p>
        </div>
        <div>
          <h2>Sản phẩm</h2>
          <a href="/#platform">Nền tảng</a>
          <a href="/#plans">Gói dịch vụ</a>
          <a href="/#how-it-works">Cách sử dụng</a>
        </div>
        <div>
          <h2>Tài khoản</h2>
          <Link to="/login">Đăng nhập</Link>
          <Link to="/register">Đăng ký tổ chức</Link>
        </div>
        <div>
          <h2>LearnUP</h2>
          <a href="/#before-you-start">Trợ giúp</a>
          <a href="/#before-you-start">Liên hệ</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          {"\u00A9"} 2026 LearnUP {"\u2022"} Giao diện minh họa
        </span>
        <span>Quản lý đào tạo cho tổ chức</span>
      </div>
    </footer>
  );
}
