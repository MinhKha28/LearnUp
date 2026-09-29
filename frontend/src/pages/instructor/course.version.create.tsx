import { message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  canCreateNewCourseVersion,
  createNewCourseVersion,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage, PageHeader } from "@/components/instructor/instructor.ui";
import "./course.version.create.scss";

const detailRows = [
  { label: "Structure", value: "Modules, Lessons, Quizzes and Assignment copied" },
  { label: "Type", value: "Public or Private carried forward" },
  { label: "Storage", value: "Source learning files referenced, without duplicate storage" },
  { label: "Approval", value: "New Draft must be submitted for Organizer review" },
];

const CourseVersionCreate = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);

  if (!course) {
    return (
      <InstructorPage className="instructor-version-create">
        <PageHeader
          eyebrow="COURSE / VERSIONS"
          title="Course not found"
          subtitle="This Course may have been removed."
          back
        />
        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Back to My Courses
        </InstructorButton>
      </InstructorPage>
    );
  }

  if (!canCreateNewCourseVersion(course)) {
    return (
      <InstructorPage className="instructor-version-create">
        <PageHeader
          eyebrow="COURSE / VERSIONS"
          title="A new version is already in progress"
          subtitle="Finish or submit the current Draft version first."
          back
        />
        <InstructorButton onClick={() => navigate(`/instructor/courses/${course.id}/versions`)}>
          Back to Version Chain
        </InstructorButton>
      </InstructorPage>
    );
  }

  const nextVersion = `v${(Number.parseInt(course.version.replace(/[^0-9]/g, ""), 10) || 1) + 1}`;

  const handleCreate = () => {
    createNewCourseVersion(course);
    message.success(`Draft ${course.version} created.`);
    navigate(`/instructor/courses/${course.id}/builder/new-version`);
  };

  return (
    <InstructorPage className="instructor-version-create">
      <PageHeader
        eyebrow="COURSE / VERSIONS"
        title="Create New Course Version"
        subtitle="Copy this Locked Course into a new Draft version."
        back
      />
      <div className="instructor-version-create-card">
        <span className="instructor-version-create-label">Source</span>
        <h2>
          {course.title} · {course.version} · Locked
        </h2>
        <div className="instructor-version-create-rows">
          {detailRows.map((row) => (
            <div className="instructor-version-create-row" key={row.label}>
              <strong>{row.label}</strong>
              <span>{row.value}</span>
            </div>
          ))}
        </div>
        <div className="instructor-version-create-actions">
          <InstructorButton type="primary" onClick={handleCreate}>
            Create Draft {nextVersion}
          </InstructorButton>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseVersionCreate;
