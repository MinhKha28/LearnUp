import { useNavigate } from "react-router-dom";
import {
  DetailItem,
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import "./subscription.renew.scss";

const SubscriptionRenew = () => {
  const navigate = useNavigate();
  return (
    <OrganizerPage className="organizer-subscription-renew">
      <PageHeader
        title="Renew Subscription"
        subtitle="Renew the current Growth plan through Mock Payment."
        actions={<OrganizerButton onClick={() => navigate(-1)}>Back</OrganizerButton>}
      />
      <div className="organizer-content-grid">
        <SectionCard title="Renewal summary">
          <div className="organizer-detail-grid">
            <DetailItem label="Current plan">Growth</DetailItem>
            <DetailItem label="Renewal duration">6 months</DetailItem>
            <DetailItem label="New expiry">18 Jun 2027</DetailItem>
            <DetailItem label="Plan limits">
              500 Learners · 25 Instructors · 50 Courses · 120 GB
            </DetailItem>
          </div>
        </SectionCard>
        <SectionCard title="Payment">
          <div className="organizer-detail-grid">
            <DetailItem label="Amount">Demo pricing</DetailItem>
            <DetailItem label="Payment service">Mock Payment Service</DetailItem>
          </div>
          <p className="organizer-note">
            No real invoice or real payment gateway is part of MVP.
          </p>
        </SectionCard>
      </div>
      <WarningPanel title="Grace period reminder">
        If renewed during the 7-day grace period, the new term starts from
        the old expiry date. If renewed after the grace period, the new term
        starts from payment date.
      </WarningPanel>
      <div className="organizer-form-actions">
        <OrganizerButton type="primary" onClick={() => navigate("/organizer/subscription")}>
          Proceed to mock payment
        </OrganizerButton>
      </div>
    </OrganizerPage>
  );
};

export default SubscriptionRenew;
