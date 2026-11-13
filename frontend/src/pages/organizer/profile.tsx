import { VietnameseAlert } from "@/components/vietnamese.controls";
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
import { initialsOf, statusLabel, statusTone, useMyProfile } from "@/hooks/use.my.profile";
import { roleLabel } from "@/utils/helper";
import "./profile.scss";

const Profile = () => {
  const { profile, loading, error, clearError } = useMyProfile();
  return (
    <OrganizerPage className="organizer-profile">
      <PageHeader
        title="Hồ sơ"
        subtitle="Quản lý thông tin tài khoản cá nhân."
        actions={
          <Link to="edit">
            <OrganizerButton type="primary">Sửa hồ sơ</OrganizerButton>
          </Link>
        }
      />
      <SectionCard>
        {error && (
          <VietnameseAlert type="error" showIcon message={error} closable onClose={clearError} />
        )}
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
                <span>{profile?.role ? roleLabel(profile.role) : ""}</span>
                <StatusTag tone={statusTone(profile?.status)}>
                  {statusLabel(profile?.status)}
                </StatusTag>
              </div>
            </div>
            <div className="organizer-divider" />
            <div className="organizer-detail-grid">
              <DetailItem label="Họ và tên">{profile?.fullName}</DetailItem>
              <DetailItem label="Email đăng nhập">{profile?.email}</DetailItem>
              <DetailItem label="Vai trò">
                {profile?.role ? roleLabel(profile.role) : ""}
              </DetailItem>
              <DetailItem label="Tổ chức">
                {profile?.organizationName}
              </DetailItem>
            </div>
            <p className="organizer-note">
              Không sửa được email trong phần hồ sơ.
            </p>
          </>
        )}
      </SectionCard>
      <SectionCard title="Bảo mật">
        <div className="organizer-security-row">
          <div>
            <strong>Mật khẩu</strong>
            <span>Đổi mật khẩu sau khi xác minh mật khẩu hiện tại.</span>
          </div>
          <Link to="change-password">
            <OrganizerButton>Đổi mật khẩu</OrganizerButton>
          </Link>
        </div>
        <p className="organizer-note">
          Quản lý đào tạo đăng nhập bằng email và mật khẩu, hoặc bằng tài khoản
          Google đã gắn với email này.
        </p>
      </SectionCard>
    </OrganizerPage>
  );
};

export default Profile;
