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
      <h1>Learning access unavailable</h1>
      <p>Your Organization&apos;s Subscription is currently Suspended.</p>
      <p>Contact your Organizer for information about access.</p>
      <Link to="/login">
        <Button>Back to sign in</Button>
      </Link>
    </section>
  </main>
);

export default SubscriptionSuspended;
