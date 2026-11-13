import { canOpenPage } from "@/utils/preview.pages";
import { Avatar, Spin } from "antd";
import { useNavigate } from "react-router-dom";
import {
  LearnerButton,
  LearnerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/learner/learner.ui";
import {
  initialsOf,
  statusLabel,
  statusTone,
  useMyProfile,
} from "@/hooks/use.my.profile";
import { roleLabel } from "@/utils/helper";
import "./profile.scss";

const Profile = () => {
  const { profile, loading } = useMyProfile();
  const navigate = useNavigate();

  return (
    <LearnerPage className="learner-profile">
      <PageHeader
        eyebrow="Tài khoản / Hồ sơ"
        title="Hồ sơ của tôi"
        subtitle="Xem và quản lý thông tin tài khoản của bạn."
        actions={
          <LearnerButton type="primary" onClick={() => navigate("edit")}>
            Sửa hồ sơ
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
              {statusLabel(profile?.status)}
            </StatusTag>
          </div>
        </div>
        <div className="learner-profile-table">
          <div className="learner-profile-row learner-profile-head">
            <span>Thông tin</span>
            <span>Giá trị</span>
          </div>
          <div className="learner-profile-row">
            <span>Địa chỉ email</span>
            <span>{profile?.email}</span>
          </div>
          <div className="learner-profile-row">
            <span>Vai trò</span>
            <span>{profile?.role ? roleLabel(profile.role) : ""}</span>
          </div>
          <div className="learner-profile-row">
            <span>Tổ chức</span>
            <span>{profile?.organizationName}</span>
          </div>
          <div className="learner-profile-row">
            <span>Đơn vị công tác</span>
            <span>{profile?.department ?? "Chưa có"}</span>
          </div>
        </div>
      </SectionCard>
      <SectionCard className="learner-profile-security">
        <div className="learner-profile-security-row">
          <div>
            <h2>Bảo mật</h2>
            <strong>Đổi mật khẩu của bạn</strong>
          </div>
          <LearnerButton onClick={() => navigate("change-password")}>
            Đổi mật khẩu
          </LearnerButton>
        </div>
        <p className="learner-profile-note">
          Bạn không tự đổi được email đăng nhập trong hồ sơ.
        </p>
      </SectionCard>
      {canOpenPage("/learner/subscription-suspended") && (
        <button
          className="learner-profile-demo-link"
          type="button"
          onClick={() => navigate("/learner/subscription-suspended")}
        >
          Xem trước: trạng thái gói dịch vụ của tổ chức đang tạm ngưng
        </button>
      )}
    </LearnerPage>
  );
};

export default Profile;
