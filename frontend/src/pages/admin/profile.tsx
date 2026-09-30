import { Avatar } from "antd";
import { Link } from "react-router-dom";
import { AdminButton, AdminPage, DetailItem, PageHeader, SectionCard, StatusTag } from "@/components/admin/admin.ui";
import { useCurrentApp } from "@/components/context/app.context";
import "./profile.scss";

const Profile = () => {
  const { user } = useCurrentApp(); const name = user?.fullName || "Rufus Lee"; const email = user?.email || "rufus.admin@gmail.com";
  return <AdminPage className="admin-profile"><PageHeader title="Profile" subtitle="Manage your personal account information." actions={<AdminButton type="primary">Edit profile</AdminButton>} /><SectionCard><div className="admin-profile-identity"><Avatar size={70}>{name.split(" ").map((part) => part[0]).join("").slice(0,2)}</Avatar><div><h2>{name}</h2><span>Platform Admin</span><StatusTag tone="success">Active</StatusTag></div></div><div className="admin-divider" /><div className="admin-detail-grid"><DetailItem label="Full name">{name}</DetailItem><DetailItem label="Login email">{email}</DetailItem><DetailItem label="Role">Admin</DetailItem></div><p className="admin-note">Email is not editable from profile settings.</p></SectionCard><SectionCard title="Security"><div className="admin-security-row"><div><strong>Password</strong><span>Change your password after verifying the current password.</span></div><Link to="change-password"><AdminButton>Change password</AdminButton></Link></div><p className="admin-note">Admin sign-in uses email and password. Single sign-on is not available for Platform Admin.</p></SectionCard></AdminPage>;
};
export default Profile;
