import { Avatar } from "antd";
import { useNavigate } from "react-router-dom";
import { useCurrentApp } from "@/components/context/app.context";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import "./profile.scss";

const Profile = () => {
  const { user } = useCurrentApp();
  const navigate = useNavigate();
  const name = user?.fullName || "Jordan Chen";
  const email = user?.email || "jordan.chen@example.com";
  const initials = name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

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
        <div className="instructor-profile-identity">
          <Avatar size={64} src={user?.avatar}>
            {initials}
          </Avatar>
          <div>
            <h2>{name}</h2>
            <StatusTag tone="success">Active</StatusTag>
          </div>
        </div>
        <div className="instructor-profile-table">
          <div className="instructor-profile-row instructor-profile-head">
            <span>Field</span>
            <span>Value</span>
          </div>
          <div className="instructor-profile-row">
            <span>Email address</span>
            <span>{email}</span>
          </div>
          <div className="instructor-profile-row">
            <span>Role</span>
            <span>Instructor</span>
          </div>
          <div className="instructor-profile-row">
            <span>Organization</span>
            <span>Demo Organization</span>
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
