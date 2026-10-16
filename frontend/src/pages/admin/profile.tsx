import { Avatar, Spin } from "antd";
import { Link } from "react-router-dom";
import { AdminButton, AdminPage, DetailItem, PageHeader, SectionCard, StatusTag } from "@/components/admin/admin.ui";
import { initialsOf, statusTone, useMyProfile } from "@/hooks/use.my.profile";
import "./profile.scss";

const Profile = () => {
  const { profile, loading } = useMyProfile();
  return (
    <AdminPage className="admin-profile">
      <PageHeader
        title="Profile"
        subtitle="Manage your personal account information."
        actions={
          <Link to="edit">
            <AdminButton type="primary">Edit profile</AdminButton>
          </Link>
        }
      />
      <SectionCard>
        {loading ? (
          <Spin />
        ) : (
          <>
            <div className="admin-profile-identity">
              <Avatar size={70} src={profile?.avatarUrl ?? undefined}>
                {initialsOf(profile?.fullName)}
              </Avatar>
              <div>
                <h2>{profile?.fullName}</h2>
                <span>Platform Admin</span>
                <StatusTag tone={statusTone(profile?.status)}>{profile?.status}</StatusTag>
              </div>
            </div>
            <div className="admin-divider" />
            <div className="admin-detail-grid">
              <DetailItem label="Full name">{profile?.fullName}</DetailItem>
              <DetailItem label="Login email">{profile?.email}</DetailItem>
              <DetailItem label="Role">{profile?.role}</DetailItem>
            </div>
            <p className="admin-note">Email is not editable from profile settings.</p>
          </>
        )}
      </SectionCard>
      <SectionCard title="Security">
        <div className="admin-security-row">
          <div>
            <strong>Password</strong>
            <span>Change your password after verifying the current password.</span>
          </div>
          <Link to="change-password">
            <AdminButton>Change password</AdminButton>
          </Link>
        </div>
        <p className="admin-note">Admin sign-in uses email and password. Single sign-on is not available for Platform Admin.</p>
      </SectionCard>
    </AdminPage>
  );
};

export default Profile;
