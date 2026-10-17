import { useNavigate } from "react-router-dom";
import {
  LearnerButton,
  LearnerPage,
  PageHeader,
  SectionCard,
} from "@/components/learner/learner.ui";
import ProfileEditor from "@/components/profile/profile.editor";
import "./profile.edit.scss";

const ProfileEdit = () => {
  const navigate = useNavigate();
  return (
    <LearnerPage className="learner-profile-edit">
      <PageHeader
        eyebrow="ACCOUNT / EDIT PROFILE"
        title="Edit Profile"
        subtitle="Update your name and avatar."
        back
      />
      <SectionCard>
        <ProfileEditor
          button={LearnerButton}
          onSaved={() => navigate("/learner/profile")}
        />
      </SectionCard>
    </LearnerPage>
  );
};

export default ProfileEdit;
