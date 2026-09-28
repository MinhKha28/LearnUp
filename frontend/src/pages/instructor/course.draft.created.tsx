import { message } from "antd";
import { InstructorPage, PageHeader, SuccessScreen } from "@/components/instructor/instructor.ui";
import "./course.create.scss";

const CourseDraftCreated = () => {
  return (
    <InstructorPage className="instructor-course-create">
      <PageHeader
        eyebrow="INSTRUCTOR"
        title="Draft Course created"
        subtitle="Continue building Modules, Lessons and Assessments."
      />
      <SuccessScreen
        tone="success"
        title="Course Draft is ready"
        primary={{
          label: "Open Course Builder",
          onClick: () => message.info("Course Builder arrives in a later batch."),
        }}
      >
        <p>Add learning content before submitting it for approval.</p>
      </SuccessScreen>
    </InstructorPage>
  );
};

export default CourseDraftCreated;
