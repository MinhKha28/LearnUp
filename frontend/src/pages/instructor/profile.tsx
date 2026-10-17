import { Avatar, Spin } from "antd";
import { useNavigate } from "react-router-dom";
import { initialsOf, statusTone, useMyProfile } from "@/hooks/use.my.profile";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import "./profile.scss";

const Profile = () => {
  const { profile, loading } = useMyProfile();
  const navigate = useNavigate();

  return (
    <InstructorPage className="instructor-profile">
      <PageHeader
        eyebrow="ACCOUNT / PROFILE"
        title="My Profile"
        subtitle="Manage your Instructor account."
        actions={
          <InstructorButton type="primary" onClick={() => navigate("edit")}>
            Edit profile
          </InstructorButton>
        }
      />
      <SectionCard>
        {loading && <Spin />}
        <div className="instructor-profile-identity">
          <Avatar size={64} src={profile?.avatarUrl ?? undefined}>
            {initialsOf(profile?.fullName)}
          </Avatar>
          <div>
            <h2>{profile?.fullName}</h2>
            <StatusTag tone={statusTone(profile?.status)}>
              {profile?.status}
            </StatusTag>
          </div>
        </div>
        <div className="instructor-profile-table">
          <div className="instructor-profile-row instructor-profile-head">
            <span>Field</span>
            <span>Value</span>
          </div>
          <div className="instructor-profile-row">
            <span>Email address</span>
            <span>{profile?.email}</span>
          </div>
          <div className="instructor-profile-row">
            <span>Role</span>
            <span>{profile?.role}</span>
          </div>
          <div className="instructor-profile-row">
            <span>Organization</span>
            <span>{profile?.organizationName}</span>
          </div>
          <div className="instructor-profile-row">
            <span>Department</span>
            <span>{profile?.department ?? "Not set"}</span>
          </div>
        </div>
      </SectionCard>
      <SectionCard className="instructor-profile-security">
        <div className="instructor-profile-security-row">
          <h2>Security</h2>
          <InstructorButton onClick={() => navigate("change-password")}>
            Change password
          </InstructorButton>
        </div>
        <p className="instructor-profile-note">The account email cannot be changed in self-service.</p>
      </SectionCard>
    </InstructorPage>
  );
};

export default Profile;
