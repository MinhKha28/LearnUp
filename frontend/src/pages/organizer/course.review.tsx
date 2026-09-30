import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import "./course.review.scss";

const modules = [
  { key: "m1", title: "Module 1 — Incident fundamentals", meta: "3 Lessons · 1 Quiz" },
  { key: "m2", title: "Module 2 — Evidence collection", meta: "3 Lessons · 1 Assignment" },
  { key: "m3", title: "Module 3 — Reporting workflow", meta: "4 Lessons · 1 Quiz" },
  { key: "m4", title: "Module 4 — Final validation", meta: "2 Lessons · 1 Assignment" },
];

const CourseReview = () => {
  const navigate = useNavigate();
  return (
    <OrganizerPage className="organizer-course-review">
      <PageHeader
        title="Review Course"
        subtitle="Incident Reporting • Submitted by Linh Phan"
        back
        actions={
          <>
            <OrganizerButton danger onClick={() => navigate("/organizer/courses/approvals")}>
              Reject
            </OrganizerButton>
            <OrganizerButton type="primary" onClick={() => navigate("/organizer/courses/approvals")}>
              Publish Course
            </OrganizerButton>
          </>
        }
      />
      <SectionCard title="Course governance">
        <div className="organizer-course-tags">
          <StatusTag tone="warning">Submitted</StatusTag>
          <StatusTag tone="neutral">Private</StatusTag>
        </div>
        <div className="organizer-metric-row">
          <div className="organizer-metric">
            <span>Instructor</span>
            <strong>Linh Phan</strong>
          </div>
          <div className="organizer-metric">
            <span>Expected completion</span>
            <strong>10 days</strong>
          </div>
          <div className="organizer-metric">
            <span>Estimated duration</span>
            <strong>8h 40m</strong>
          </div>
        </div>
      </SectionCard>
      <div className="organizer-content-grid organizer-course-review-grid">
        <SectionCard title="Course overview">
          <div className="organizer-detail-grid">
            <div className="organizer-detail-item">
              <span>Training objective</span>
              <strong>Standardize incident reporting across teams.</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Learning outcomes</span>
              <strong>Identify incidents, document evidence, submit reports correctly.</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Course type</span>
              <strong>Private</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Learning structure</span>
              <strong>4 Modules · 12 Lessons · 3 Quizzes · 2 Assignments</strong>
            </div>
            <div className="organizer-detail-item">
              <span>First Review</span>
              <strong>Practice on final Assignment</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Locked</span>
              <strong>No — no Enrollment yet</strong>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Curriculum review">
          <div className="organizer-course-modules">
            {modules.map((module) => (
              <div key={module.key}>
                <div>
                  <strong>{module.title}</strong>
                  <span>{module.meta}</span>
                </div>
                <button className="organizer-link">Open</button>
              </div>
            ))}
          </div>
          <div className="organizer-approval-note">
            <strong>Approval reset</strong>
            <span>Approve → Published · Reject → Reported with reason</span>
          </div>
        </SectionCard>
      </div>
    </OrganizerPage>
  );
};

export default CourseReview;
