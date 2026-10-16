import { Avatar, Spin } from "antd";
import { Link } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  DetailItem,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import { initialsOf, statusTone, useMyProfile } from "@/hooks/use.my.profile";
import "./profile.scss";

const Profile = () => {
  const { profile, loading } = useMyProfile();
  return (
    <OrganizerPage className="organizer-profile">
      <PageHeader
        title="Profile"
        subtitle="Manage your personal account information."
        actions={
          <Link to="edit">
            <OrganizerButton type="primary">Edit profile</OrganizerButton>
          </Link>
        }
      />
      <SectionCard>
        {loading ? (
          <Spin />
        ) : (
          <>
            <div className="organizer-profile-identity">
              <Avatar size={70} src={profile?.avatarUrl ?? undefined}>
                {initialsOf(profile?.fullName)}
              </Avatar>
              <div>
                <h2>{profile?.fullName}</h2>
                <span>{profile?.role}</span>
                <StatusTag tone={statusTone(profile?.status)}>
                  {profile?.status}
                </StatusTag>
              </div>
            </div>
            <div className="organizer-divider" />
            <div className="organizer-detail-grid">
              <DetailItem label="Full name">{profile?.fullName}</DetailItem>
              <DetailItem label="Login email">{profile?.email}</DetailItem>
              <DetailItem label="Role">{profile?.role}</DetailItem>
              <DetailItem label="Organization">
                {profile?.organizationName}
              </DetailItem>
            </div>
            <p className="organizer-note">
              Email is not editable from profile settings.
            </p>
          </>
        )}
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
