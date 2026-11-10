import MemberImport from "@/components/organizer/member.import";
import {
  confirmLearnerImportAPI,
  downloadLearnerImportTemplateAPI,
  previewLearnerImportAPI,
} from "@/services/organization.service";
import "./instructor.import.scss";

// UC13.8 - Import Learner hàng loạt: cùng luồng với UC12.8 (MemberImport).
// Dùng chung style của trang import Instructor nên giữ class organizer-instructor-import.
const LearnerImport = () => (
  <MemberImport
    role="Learner"
    className="organizer-instructor-import"
    listPath="/organizer/learners"
    templateFileName="learnup-learner-import-template.xlsx"
    downloadTemplate={downloadLearnerImportTemplateAPI}
    previewImport={previewLearnerImportAPI}
    confirmImport={confirmLearnerImportAPI}
  />
);

export default LearnerImport;
