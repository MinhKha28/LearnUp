import { Avatar } from "antd";
import { Link } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  DetailItem,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import { useCurrentApp } from "@/components/context/app.context";
import "./profile.scss";

const Profile = () => {
  const { user } = useCurrentApp();
  const name = user?.fullName || "Mai Nguyen";
  const email = user?.email || "mai.nguyen@northstar.example";
  return (
    <OrganizerPage className="organizer-profile">
      <PageHeader
        title="Profile"
        subtitle="Manage your personal account information."
        actions={<OrganizerButton type="primary">Edit profile</OrganizerButton>}
      />
      <SectionCard>
        <div className="organizer-profile-identity">
          <Avatar size={70}>
            {name.split(" ").map((part) => part[0]).join("").slice(0, 2)}
          </Avatar>
          <div>
            <h2>{name}</h2>
            <span>Organizer</span>
            <StatusTag tone="success">Active</StatusTag>
          </div>
        </div>
        <div className="organizer-divider" />
        <div className="organizer-detail-grid">
          <DetailItem label="Full name">{name}</DetailItem>
          <DetailItem label="Login email">{email}</DetailItem>
          <DetailItem label="Role">Organizer</DetailItem>
          <DetailItem label="Organization">Northstar Learning</DetailItem>
        </div>
        <p className="organizer-note">Email is not editable from profile settings.</p>
      </SectionCard>
      <SectionCard title="Security">
        <div className="organizer-security-row">
          <div>
            <strong>Password</strong>
            <span>Change your password after verifying the current password.</span>
          </div>
          <Link to="change-password">
            <OrganizerButton>Change password</OrganizerButton>
          </Link>
        </div>
        <p className="organizer-note">
          Organizer sign-in uses email and password. Single sign-on is not
          available for Organizer.
        </p>
      </SectionCard>
    </OrganizerPage>
  );
};

export default Profile;
