import { useNavigate } from "react-router-dom";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
} from "@/components/instructor/instructor.ui";
import ProfileEditor from "@/components/profile/profile.editor";
import "./profile.edit.scss";

const ProfileEdit = () => {
  const navigate = useNavigate();
  return (
    <InstructorPage className="instructor-profile-edit">
      <PageHeader
        eyebrow="ACCOUNT / EDIT PROFILE"
        title="Edit Profile"
        subtitle="Update your name and avatar."
        back
      />
      <SectionCard>
        <ProfileEditor
          button={InstructorButton}
          onSaved={() => navigate("/instructor/profile")}
        />
      </SectionCard>
    </InstructorPage>
  );
};

export default ProfileEdit;
