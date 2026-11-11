import { Avatar, Spin } from "antd";
import { useNavigate } from "react-router-dom";
import { initialsOf, statusLabel, statusTone, useMyProfile } from "@/hooks/use.my.profile";
import { roleLabel } from "@/utils/helper";
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
        eyebrow="Tài khoản / Hồ sơ"
        title="Hồ sơ của tôi"
        subtitle="Quản lý tài khoản giảng viên của bạn."
        actions={
          <InstructorButton type="primary" onClick={() => navigate("edit")}>
            Sửa hồ sơ
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
              {statusLabel(profile?.status)}
            </StatusTag>
          </div>
        </div>
        <div className="instructor-profile-table">
          <div className="instructor-profile-row instructor-profile-head">
            <span>Thông tin</span>
            <span>Giá trị</span>
          </div>
          <div className="instructor-profile-row">
            <span>Địa chỉ email</span>
            <span>{profile?.email}</span>
          </div>
          <div className="instructor-profile-row">
            <span>Vai trò</span>
            <span>{profile?.role ? roleLabel(profile.role) : ""}</span>
          </div>
          <div className="instructor-profile-row">
            <span>Tổ chức</span>
            <span>{profile?.organizationName}</span>
          </div>
          <div className="instructor-profile-row">
            <span>Đơn vị công tác</span>
            <span>{profile?.department ?? "Chưa có"}</span>
          </div>
        </div>
      </SectionCard>
      <SectionCard className="instructor-profile-security">
        <div className="instructor-profile-security-row">
          <h2>Bảo mật</h2>
          <InstructorButton onClick={() => navigate("change-password")}>
            Đổi mật khẩu
          </InstructorButton>
        </div>
        <p className="instructor-profile-note">Bạn không tự đổi được email của tài khoản.</p>
      </SectionCard>
    </InstructorPage>
  );
};

export default Profile;
