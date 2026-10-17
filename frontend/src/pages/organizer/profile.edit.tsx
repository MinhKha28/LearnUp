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
        title="Edit Profile"
        subtitle="Update your name and avatar."
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
