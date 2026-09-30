import { Avatar } from "antd";
import { Link } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import "./organization.scss";

const Organization = () => (
  <OrganizerPage className="organizer-organization">
    <PageHeader
      title="Organization"
      subtitle="View organization identity, contact details, logo, and timezone."
      actions={
        <Link to="/organizer/organization/edit">
          <OrganizerButton type="primary">Edit organization</OrganizerButton>
        </Link>
      }
    />
    <SectionCard>
      <div className="organizer-org-identity">
        <Avatar shape="square" size={72}>
          NL
        </Avatar>
        <div>
          <h2>Northstar Learning</h2>
          <span>Organization profile</span>
        </div>
      </div>
      <div className="organizer-divider" />
      <div className="organizer-detail-grid">
        <div className="organizer-detail-item">
          <span>Organization name</span>
          <strong>Northstar Learning Co., Ltd.</strong>
        </div>
        <div className="organizer-detail-item">
          <span>Contact</span>
          <strong>training@northstar.example</strong>
        </div>
        <div className="organizer-detail-item">
          <span>Tax code</span>
          <strong>1801234567</strong>
        </div>
        <div className="organizer-detail-item">
          <span>Timezone</span>
          <strong>Asia/Ho_Chi_Minh</strong>
        </div>
        <div className="organizer-detail-item">
          <span>Address</span>
          <strong>Can Tho City, Viet Nam</strong>
        </div>
        <div className="organizer-detail-item">
          <span>Legal note</span>
          <strong>Tax code is identity information only, invoicing is outside MVP.</strong>
        </div>
      </div>
    </SectionCard>
    <WarningPanel title="Timezone affects deadlines">
      Organization timezone determines Required Course completion deadlines
      and Peer Review cycle review deadlines.
    </WarningPanel>
  </OrganizerPage>
);

export default Organization;
