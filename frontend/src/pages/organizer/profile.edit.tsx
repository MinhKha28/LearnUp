import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import ProfileEditor from "@/components/profile/profile.editor";

const ProfileEdit = () => {
  const navigate = useNavigate();
  return (
    <OrganizerPage className="organizer-profile-edit">
      <PageHeader
        title="Sửa hồ sơ"
        subtitle="Cập nhật họ tên và ảnh đại diện."
        back
      />
      <SectionCard>
        <ProfileEditor
          button={OrganizerButton}
          onSaved={() => navigate("/organizer/profile")}
        />
      </SectionCard>
    </OrganizerPage>
  );
};

export default ProfileEdit;
