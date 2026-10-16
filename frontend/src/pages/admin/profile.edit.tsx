import { useNavigate } from "react-router-dom";
import {
  AdminButton,
  AdminPage,
  PageHeader,
  SectionCard,
} from "@/components/admin/admin.ui";
import ProfileEditor from "@/components/profile/profile.editor";

const ProfileEdit = () => {
  const navigate = useNavigate();
  return (
    <AdminPage className="admin-profile-edit">
      <PageHeader title="Edit Profile" subtitle="Update your name and avatar." />
      <SectionCard>
        <ProfileEditor
          button={AdminButton}
          onSaved={() => navigate("/admin/profile")}
        />
      </SectionCard>
    </AdminPage>
  );
};

export default ProfileEdit;
