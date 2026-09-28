import { Avatar } from "antd";
import { useNavigate } from "react-router-dom";
import {
  LearnerButton,
  LearnerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/learner/learner.ui";
import { useCurrentApp } from "@/components/context/app.context";
import "./profile.scss";

const Profile = () => {
  const { user } = useCurrentApp();
  const navigate = useNavigate();
  const name = user?.fullName || "Alex Morgan";
  const email = user?.email || "alex.morgan@example.com";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
        <div className="learner-profile-identity">
          <Avatar size={64} src={user?.avatar}>
            {initials}
          </Avatar>
          <div>
            <h2>{name}</h2>
            <StatusTag tone="success">Active</StatusTag>
          </div>
        </div>
        <div className="learner-profile-table">
          <div className="learner-profile-row learner-profile-head">
            <span>Field</span>
            <span>Value</span>
          </div>
          <div className="learner-profile-row">
            <span>Email address</span>
            <span>{email}</span>
          </div>
          <div className="learner-profile-row">
            <span>Role</span>
            <span>Learner</span>
          </div>
          <div className="learner-profile-row">
            <span>Organization</span>
            <span>Demo Organization</span>
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
