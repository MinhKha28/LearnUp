import { useNavigate, useParams } from "react-router-dom";
import {
  canCreateNewCourseVersion,
  courseVersionRecords,
  findInstructorCourse,
} from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage, PageHeader } from "@/components/instructor/instructor.ui";
import "./course.versions.scss";

const CourseVersions = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);

  if (!course) {
    return (
      <InstructorPage className="instructor-course-versions">
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

  const records = courseVersionRecords(course);

  return (
    <InstructorPage className="instructor-course-versions">
      <PageHeader
        eyebrow="COURSE / VERSIONS"
        title="Course Version Chain"
        subtitle="See every version and the currently Published Course."
        back
        actions={
          canCreateNewCourseVersion(course) ? (
            <InstructorButton
              type="primary"
              onClick={() => navigate(`/instructor/courses/${course.id}/versions/new`)}
            >
              Create new version
            </InstructorButton>
          ) : undefined
        }
      />
      <div className="instructor-versions-table">
        <div className="instructor-versions-row instructor-versions-head">
          <span>Version</span>
          <span>Status</span>
          <span>Created</span>
          <span>Published</span>
          <span>Learning</span>
          <span>Completed</span>
          <span>Certificates</span>
        </div>
        {records.length === 0 && (
          <div className="instructor-versions-row">
            <span>This Course has not been Published yet.</span>
          </div>
        )}
        {records.map((record) => (
          <div className="instructor-versions-row" key={record.version}>
            <strong>{record.version}</strong>
            <span>{record.statusLabel}</span>
            <span>{record.createdDate}</span>
            <span>{record.publishedDate}</span>
            <span>{record.learners}</span>
            <span>{record.completed}</span>
            <span>{record.certificates}</span>
          </div>
        ))}
      </div>
      <div className="instructor-versions-note">
        <strong>Version continuity</strong>
        <p>When a new version is Published, the previous one becomes Archived.</p>
      </div>
      <p className="instructor-versions-footnote">
        Enrolled Learners continue learning on their original Course version.
      </p>
    </InstructorPage>
  );
};

export default CourseVersions;
