import { Avatar, Spin } from "antd";
import { useNavigate } from "react-router-dom";
import {
  LearnerButton,
  LearnerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/learner/learner.ui";
import { initialsOf, statusTone, useMyProfile } from "@/hooks/use.my.profile";
import "./profile.scss";

const Profile = () => {
  const { profile, loading } = useMyProfile();
  const navigate = useNavigate();

  return (
    <LearnerPage className="learner-profile">
      <PageHeader
        eyebrow="ACCOUNT / PROFILE"
        title="My Profile"
        subtitle="View and manage your account information."
        actions={
          <LearnerButton type="primary" onClick={() => navigate("edit")}>
            Edit profile
          </LearnerButton>
        }
      />
      <SectionCard>
        {loading && <Spin />}
        <div className="learner-profile-identity">
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
        <div className="learner-profile-table">
          <div className="learner-profile-row learner-profile-head">
            <span>Field</span>
            <span>Value</span>
          </div>
          <div className="learner-profile-row">
            <span>Email address</span>
            <span>{profile?.email}</span>
          </div>
          <div className="learner-profile-row">
            <span>Role</span>
            <span>{profile?.role}</span>
          </div>
          <div className="learner-profile-row">
            <span>Organization</span>
            <span>{profile?.organizationName}</span>
          </div>
          <div className="learner-profile-row">
            <span>Department</span>
            <span>{profile?.department ?? "Not set"}</span>
          </div>
        </div>
      </SectionCard>
      <SectionCard className="learner-profile-security">
        <div className="learner-profile-security-row">
          <div>
            <h2>Security</h2>
            <strong>Change your password</strong>
          </div>
          <LearnerButton onClick={() => navigate("change-password")}>
            Change password
          </LearnerButton>
        </div>
        <p className="learner-profile-note">
          Your login email cannot be changed in your own profile.
        </p>
      </SectionCard>
      <button
        className="learner-profile-demo-link"
        type="button"
        onClick={() => navigate("/learner/subscription-suspended")}
      >
        Preview: Organization subscription suspended state
      </button>
    </LearnerPage>
  );
};

export default Profile;
