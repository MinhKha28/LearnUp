import { useNavigate, useParams } from "react-router-dom";
import { catalogCourseDetails } from "@/components/learner/learner.data";
import { LearnerButton, LearnerPage, PageHeader } from "@/components/learner/learner.ui";
import "./course.overview.scss";

const CourseOverview = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? catalogCourseDetails[courseId] : undefined;

  if (!course) {
    return (
      <LearnerPage className="course-overview">
        <PageHeader
          eyebrow="CATALOG / COURSE"
          title="Course not found"
          subtitle="This Course is not available in the Catalog."
          back
        />
        <LearnerButton onClick={() => navigate("/learner/catalog")}>Back to Catalog</LearnerButton>
      </LearnerPage>
    );
  }

  const handleEnroll = () => {
    navigate(`/learner/catalog/${course.id}/${course.previouslyWithdrawn ? "restored" : "enrolled"}`);
  };

  return (
    <LearnerPage className="course-overview">
      <PageHeader
        eyebrow="CATALOG / COURSE"
        title={course.title}
        subtitle={`Course overview / ${course.status} / Public Course`}
        back
      />
      <div className="course-overview-body">
        <div className="course-overview-card">
          <div className="course-overview-banner">
            <span>LEARNUP COURSE</span>
            <strong>{course.title}</strong>
          </div>
          <div className="course-overview-section">
            <h3>Learning objectives</h3>
            {course.objectives.map((objective) => (
              <p key={objective}>{objective}</p>
            ))}
          </div>
          <div className="course-overview-section">
            <h3>Course structure</h3>
            {course.modules.map((module) => (
              <p key={module.label}>
                {module.label} • {module.name}
              </p>
            ))}
          </div>
          <div className="course-overview-section course-overview-certificate">
            <h3>Certificate conditions</h3>
            <p>{course.certificateConditions}</p>
          </div>
        </div>
        <div className="course-overview-enrollment">
          <h3>Enrollment</h3>
          <span className="course-overview-tag">Optional</span>
          <p>
            Self-enrollment needs no approval.
            <br />
            Optional Courses have no due date.
          </p>
          <LearnerButton type="primary" block onClick={handleEnroll}>
            Enroll in this Course
          </LearnerButton>
        </div>
      </div>
    </LearnerPage>
  );
};

export default CourseOverview;
