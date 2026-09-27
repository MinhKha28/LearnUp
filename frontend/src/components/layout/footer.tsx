import { Link, useLocation } from "react-router-dom";
import "@/components/layout/footer.scss";

export default function Footer() {
  const { pathname } = useLocation();

  if (pathname.startsWith("/register")) {
    return (
      <footer className="footer-compact">
        <span>{"\u00A9"} LearnUP</span>
        <span>Organization training management</span>
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
            Training operations, courses and progress
            <br />
            in one organizational workspace.
          </p>
        </div>
        <div>
          <h2>PRODUCT</h2>
          <a href="/#platform">Platform</a>
          <a href="/#plans">Plans</a>
          <a href="/#how-it-works">How it works</a>
        </div>
        <div>
          <h2>ACCOUNT</h2>
          <Link to="/login">Sign in</Link>
          <Link to="/register">Register organization</Link>
        </div>
        <div>
          <h2>LEARNUP</h2>
          <a href="/#before-you-start">Help</a>
          <a href="/#before-you-start">Contact</a>
        </div>
      </div>
      <div className="footer-bottom">
        <span>
          {"\u00A9"} 2026 LearnUP {"\u2022"} Demonstration interface
        </span>
        <span>Organization training management</span>
      </div>
    </footer>
  );
}
