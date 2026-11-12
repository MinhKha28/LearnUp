import { ExclamationCircleFilled } from "@ant-design/icons";
import { Button } from "antd";
import { Link } from "react-router-dom";
import "./subscription.suspended.scss";

// Reachable full-page blocked state shown instead of the Learner workspace when the
// organization's subscription is suspended. Linked from the Profile page for this demo
// (see the "Preview" link in pages/learner/profile.tsx); in a real deployment this would
// replace the Learner shell whenever the organization's subscription status is Suspended.
const SubscriptionSuspended = () => (
  <main className="subscription-suspended">
    <Link className="subscription-suspended-logo" to="/">
      <img src="/logo/learnup-logo-dark.png" alt="LearnUP" />
    </Link>
    <section className="subscription-suspended-card">
      <div className="subscription-suspended-icon">
        <ExclamationCircleFilled />
      </div>
      <h1>Không thể truy cập nội dung học tập</h1>
      <p>Gói dịch vụ của tổ chức bạn đang bị tạm ngưng.</p>
      <p>Liên hệ Quản lý đào tạo để biết thêm về quyền truy cập.</p>
      <Link to="/login">
        <Button>Quay lại trang đăng nhập</Button>
      </Link>
    </section>
  </main>
);

export default SubscriptionSuspended;
