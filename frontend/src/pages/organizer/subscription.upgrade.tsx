import { useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import "./subscription.upgrade.scss";

const plans = [
  {
    key: "growth",
    name: "Growth",
    current: true,
    limits: "500 Learners · 25 Instructors · 50 Courses · 120 GB",
    note: "Expiry date remains 18 Dec 2026 after upgrade.",
  },
  {
    key: "enterprise",
    name: "Enterprise",
    current: false,
    limits: "2,000 Learners · 100 Instructors · 200 Courses · 500 GB",
    note: "Expiry date remains 18 Dec 2026 after upgrade. New limits apply immediately after successful mock payment.",
  },
];

const SubscriptionUpgrade = () => {
  const navigate = useNavigate();
  const [selectedPlan, setSelectedPlan] = useState("enterprise");
  return (
    <OrganizerPage className="organizer-subscription-upgrade">
      <PageHeader
        title="Upgrade Subscription"
        subtitle="Choose a plan whose limits are greater than or equal to current usage."
        actions={<OrganizerButton onClick={() => navigate(-1)}>Back</OrganizerButton>}
      />
      <div className="organizer-plan-grid">
        {plans.map((plan) => (
          <button
            key={plan.key}
            type="button"
            className={`organizer-plan-card ${
              selectedPlan === plan.key ? "organizer-plan-card-selected" : ""
            }`}
            onClick={() => setSelectedPlan(plan.key)}
          >
            <div className="organizer-plan-card-heading">
              <h2>{plan.name}</h2>
              {plan.current && <StatusTag tone="neutral">Current</StatusTag>}
              {selectedPlan === plan.key && (
                <span className="organizer-plan-card-badge">Selected</span>
              )}
            </div>
            <p className="organizer-plan-limits">{plan.limits}</p>
            <p className="organizer-note">{plan.note}</p>
          </button>
        ))}
      </div>
      <div className="organizer-upgrade-footer">
        <div>
          <strong>Current usage check</strong>
          <p className="organizer-note">
            318 Learners · 18 Instructors · 32 Courses · 91 GB storage —{" "}
            {plans.find((plan) => plan.key === selectedPlan)?.name} covers all
            current usage.
          </p>
        </div>
        <OrganizerButton
          type="primary"
          onClick={() => navigate("/organizer/subscription")}
        >
          Continue to payment
        </OrganizerButton>
      </div>
    </OrganizerPage>
  );
};

export default SubscriptionUpgrade;
