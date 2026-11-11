import MemberImport from "@/components/organizer/member.import";
import {
  confirmInstructorImportAPI,
  downloadInstructorImportTemplateAPI,
  previewInstructorImportAPI,
} from "@/services/organization.service";
import "./instructor.import.scss";

// UC12.8 - Import Instructor hàng loạt (luồng chung với UC13.8 ở MemberImport)
const InstructorImport = () => (
  <MemberImport
    role="Instructor"
    className="organizer-instructor-import"
    listPath="/organizer/instructors"
    templateFileName="learnup-instructor-import-template.xlsx"
    downloadTemplate={downloadInstructorImportTemplateAPI}
    previewImport={previewInstructorImportAPI}
    confirmImport={confirmInstructorImportAPI}
  />
);

export default InstructorImport;
