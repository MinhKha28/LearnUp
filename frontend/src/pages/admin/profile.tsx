import { Avatar, Spin } from "antd";
import { Link } from "react-router-dom";
import { AdminButton, AdminPage, DetailItem, PageHeader, SectionCard, StatusTag } from "@/components/admin/admin.ui";
import { initialsOf, statusLabel, statusTone, useMyProfile } from "@/hooks/use.my.profile";
import { roleLabel } from "@/utils/helper";
import "./profile.scss";

const Profile = () => {
  const { profile, loading } = useMyProfile();
  return (
    <AdminPage className="admin-profile">
      <PageHeader
        title="Hồ sơ"
        subtitle="Quản lý thông tin tài khoản cá nhân."
        actions={
          <Link to="edit">
            <AdminButton type="primary">Sửa hồ sơ</AdminButton>
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
                <span>Quản trị viên nền tảng</span>
                <StatusTag tone={statusTone(profile?.status)}>{statusLabel(profile?.status)}</StatusTag>
              </div>
            </div>
            <div className="admin-divider" />
            <div className="admin-detail-grid">
              <DetailItem label="Họ và tên">{profile?.fullName}</DetailItem>
              <DetailItem label="Email đăng nhập">{profile?.email}</DetailItem>
              <DetailItem label="Vai trò">{profile?.role === "Admin" ? "Quản trị viên nền tảng" : profile?.role ? roleLabel(profile.role) : ""}</DetailItem>
            </div>
            <p className="admin-note">Không sửa được email trong phần hồ sơ.</p>
          </>
        )}
      </SectionCard>
      <SectionCard title="Bảo mật">
        <div className="admin-security-row">
          <div>
            <strong>Mật khẩu</strong>
            <span>Đổi mật khẩu sau khi xác minh mật khẩu hiện tại.</span>
          </div>
          <Link to="change-password">
            <AdminButton>Đổi mật khẩu</AdminButton>
          </Link>
        </div>
        <p className="admin-note">Quản trị viên đăng nhập bằng email và mật khẩu. Quản trị viên nền tảng không đăng nhập được bằng Google.</p>
      </SectionCard>
    </AdminPage>
  );
};

export default Profile;
