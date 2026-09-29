import { Modal, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findContentModerationCase,
  findInstructorCourse,
  removeInstructorCourse,
} from "@/components/instructor/instructor.data";
import {
  DetailItem,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
  SuccessScreen,
  WarningPanel,
} from "@/components/instructor/instructor.ui";
import "./course.detail.scss";

const CourseDetail = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const moderationCase = findContentModerationCase(courseId);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const moderationBanner = moderationCase && !moderationCase.escalated && (
    <button
      type="button"
      className="instructor-course-detail-moderation-trigger"
      onClick={() => navigate(`/instructor/courses/${courseId}/content-review`)}
    >
      <WarningPanel title="Content correction requested">
        An Organizer confirmed a report about "{moderationCase.reportedItemTitle}".{" "}
        {moderationCase.correctionSubmitted ? "Reconsideration submitted." : "Review the request."}
      </WarningPanel>
    </button>
  );

  if (!course) {
    return (
      <InstructorPage className="instructor-course-detail">
        <PageHeader
          eyebrow="MY COURSES"
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

  const confirmDelete = () => {
    setDeleteOpen(false);
    if (course.hasPastEnrollment) {
      navigate(`/instructor/courses/${course.id}/delete-blocked`);
      return;
    }
    removeInstructorCourse(course.id);
    message.success("Course deleted.");
    navigate("/instructor/courses");
  };

  // ---- Submitted: awaiting the Organizer's decision ----
  if (course.status === "submitted") {
    return (
      <InstructorPage className="instructor-course-detail">
        <PageHeader
          eyebrow="COURSE / APPROVAL"
          title="Course Submitted"
          subtitle="The Organizer has been notified and can review this Course."
          back
        />
        <SuccessScreen
          tone="success"
          title="Awaiting Organizer review"
          secondary={{
            label: "Withdraw submission",
            onClick: () => navigate(`/instructor/courses/${course.id}/withdraw`),
          }}
        >
          <p>Status: Submitted • The Course is not yet available to Learners.</p>
        </SuccessScreen>
      </InstructorPage>
    );
  }

  // ---- Rejected: show the Organizer's feedback and a path back to Submitted ----
  if (course.status === "rejected") {
    return (
      <InstructorPage className="instructor-course-detail">
        <PageHeader
          eyebrow="COURSE / APPROVAL"
          title="Course Rejected"
          subtitle="Review the Organizer's reason and revise this Course."
          back
        />
        <div className="instructor-status-card">
          <StatusTag tone="error">Rejected</StatusTag>
          <h2>{course.title}</h2>
          <div className="instructor-status-card-feedback">
            <strong>Organizer feedback</strong>
            <p>{course.rejectionReason}</p>
          </div>
          <p className="instructor-status-card-note">Edit this Course while it remains Rejected.</p>
          <p className="instructor-status-card-note">
            When ready, submit directly from Rejected to Submitted.
          </p>
          <div className="instructor-status-card-actions">
            <InstructorButton
              type="primary"
              onClick={() => navigate(`/instructor/courses/${course.id}/builder`)}
            >
              Open Builder
            </InstructorButton>
            <InstructorButton onClick={() => navigate(`/instructor/courses/${course.id}/submit`)}>
              Resubmit Course
            </InstructorButton>
            <InstructorButton danger onClick={() => setDeleteOpen(true)}>
              Delete Course
            </InstructorButton>
          </div>
        </div>
        <Modal
          className="instructor-delete-modal"
          open={deleteOpen}
          onCancel={() => setDeleteOpen(false)}
          closable={false}
          centered
          width={520}
          footer={null}
        >
          <h3>Delete this Rejected Course?</h3>
          <div className="instructor-delete-warning">
            <strong>Delete this Rejected Course?</strong>
            <p>This removes the Course and frees Course and storage quota.</p>
          </div>
          <p className="instructor-delete-note">
            Deletion is available only for Draft or Rejected with no past Enrollment.
          </p>
          <div className="instructor-delete-actions">
            <InstructorButton onClick={() => setDeleteOpen(false)}>Cancel</InstructorButton>
            <InstructorButton type="primary" onClick={confirmDelete}>
              Delete Course
            </InstructorButton>
          </div>
        </Modal>
      </InstructorPage>
    );
  }

  // ---- Published: live Course, entry point to the Builder and Version Chain ----
  if (course.status === "published") {
    return (
      <InstructorPage className="instructor-course-detail">
        <PageHeader
          eyebrow="COURSE / PUBLISHED"
          title="Course Published"
          subtitle="Your Course is available according to its Public or Private type."
          back
          actions={
            <InstructorButton onClick={() => navigate(`/instructor/courses/${course.id}/versions`)}>
              Version chain
            </InstructorButton>
          }
        />
        {moderationBanner}
        <div className="instructor-status-card">
          <StatusTag tone="success">Published</StatusTag>
          <h2>{course.title}</h2>
          <p className="instructor-status-card-note">
            Public: visible in the Learner Catalog; Private: visible only to Learners with an existing
            Enrollment. Only Organizer assigns Required training.
          </p>
          <hr className="instructor-status-card-divider" />
          <h3>Enrollment changes Course editability</h3>
          <p className="instructor-status-card-note">
            Course becomes Locked after the first Required or Optional Enrollment.
          </p>
          <p className="instructor-status-card-note">
            Learners already enrolled keep access to an Archived version.
          </p>
          <div className="instructor-status-card-actions instructor-status-card-actions-end">
            <InstructorButton onClick={() => navigate(`/instructor/courses/${course.id}/edit`)}>
              Edit Course Details
            </InstructorButton>
            <InstructorButton
              type="primary"
              onClick={() => navigate(`/instructor/courses/${course.id}/builder`)}
            >
              Open Course
            </InstructorButton>
          </div>
        </div>
      </InstructorPage>
    );
  }

  // ---- Draft (default): full editable descriptive detail ----
  return (
    <InstructorPage className="instructor-course-detail">
      <PageHeader
        eyebrow="MY COURSES / COURSE"
        title={course.title}
        subtitle={`Course ${course.version} • ${course.visibility} • Draft`}
        back
      />
      {moderationBanner}
      <div className="instructor-course-detail-grid">
        <SectionCard className="instructor-course-detail-main">
          <div className="instructor-course-detail-block">
            <h2>Training objective</h2>
            <p>{course.trainingObjective}</p>
          </div>
          <div className="instructor-course-detail-block">
            <h2>Learning Outcomes</h2>
            {course.learningOutcomes.map((outcome) => (
              <p key={outcome}>{outcome}</p>
            ))}
          </div>
          <div className="instructor-course-detail-block instructor-course-detail-block-last">
            <h2>Course information</h2>
            <div className="instructor-course-info-table">
              <div className="instructor-course-info-row instructor-course-info-head">
                <span>Field</span>
                <span>Value</span>
              </div>
              <div className="instructor-course-info-row">
                <DetailItem label="Planned completion">
                  {course.plannedCompletionDays
                    ? `${course.plannedCompletionDays} days`
                    : "[Configured days]"}
                </DetailItem>
                <span />
              </div>
              <div className="instructor-course-info-row">
                <strong>Estimated learning time</strong>
                <span>System-calculated: Video + Reading + Assignment</span>
              </div>
              <div className="instructor-course-info-row">
                <strong>Visibility</strong>
                <span>{course.visibility} Course</span>
              </div>
              <div className="instructor-course-info-row">
                <strong>Approval status</strong>
                <span>Draft</span>
              </div>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Actions" className="instructor-course-actions-card">
          <InstructorButton
            block
            onClick={() => navigate(`/instructor/courses/${course.id}/edit`)}
          >
            Edit descriptive details
          </InstructorButton>
          <InstructorButton
            block
            onClick={() => navigate(`/instructor/courses/${course.id}/builder`)}
          >
            Continue in Builder
          </InstructorButton>
          <InstructorButton
            block
            type="primary"
            onClick={() => navigate(`/instructor/courses/${course.id}/submit`)}
          >
            Submit for review
          </InstructorButton>
          {course.publishedVersion && course.publishedVersion !== course.version ? (
            <InstructorButton
              block
              onClick={() => navigate(`/instructor/courses/${course.id}/versions`)}
            >
              View version chain
            </InstructorButton>
          ) : (
            <InstructorButton block danger onClick={() => setDeleteOpen(true)}>
              Delete Course
            </InstructorButton>
          )}
        </SectionCard>
      </div>
      <Modal
        className="instructor-delete-modal"
        open={deleteOpen}
        onCancel={() => setDeleteOpen(false)}
        closable={false}
        centered
        width={520}
        footer={null}
      >
        <h3>Delete this Draft Course?</h3>
        <div className="instructor-delete-warning">
          <strong>Delete this Draft Course?</strong>
          <p>This removes the Draft and frees Course and storage quota.</p>
        </div>
        <p className="instructor-delete-note">
          Deletion is available only for Draft or Rejected with no past Enrollment.
        </p>
        <div className="instructor-delete-actions">
          <InstructorButton onClick={() => setDeleteOpen(false)}>Cancel</InstructorButton>
          <InstructorButton type="primary" onClick={confirmDelete}>
            Delete Draft
          </InstructorButton>
        </div>
      </Modal>
    </InstructorPage>
  );
};

export default CourseDetail;
