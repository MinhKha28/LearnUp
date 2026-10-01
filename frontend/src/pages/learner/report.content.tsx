import { useState } from "react";
import { Input, Select, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import {
  courseDetails,
  findResource,
  type ReportContentType,
} from "@/components/learner/learner.data";
import { InfoPanel, LearnerButton, LearnerPage, PageHeader, SectionCard } from "@/components/learner/learner.ui";
import "./report.content.scss";

const contentTypeOptions: { value: ReportContentType; label: string }[] = [
  { value: "Lesson", label: "Lesson" },
  { value: "Video", label: "Video" },
  { value: "Reading", label: "Reading" },
  { value: "Quiz", label: "Quiz" },
  { value: "Assignment", label: "Assignment" },
];

const ReportContent = () => {
  const { enrollmentId: courseId, lessonId, resourceId } = useParams();
  const navigate = useNavigate();
  const course = courseId ? courseDetails[courseId] : undefined;
  const found = course ? findResource(course, lessonId, resourceId) : undefined;

  const defaultContentType: ReportContentType = found?.resource.type === "video" ? "Video" : "Reading";
  const [reportedItem, setReportedItem] = useState(
    found ? `Lesson: ${found.resource.title}` : "",
  );
  const [contentType, setContentType] = useState<ReportContentType>(defaultContentType);
  const [reason, setReason] = useState("");

  if (!course || !found) {
    return (
      <LearnerPage className="report-content">
        <PageHeader eyebrow="COURSE / REPORT CONTENT" title="Content not found" subtitle="" back />
        <LearnerButton onClick={() => navigate("/learner/courses")}>Back to My Courses</LearnerButton>
      </LearnerPage>
    );
  }

  const submit = () => {
    if (!reason.trim()) {
      message.warning("Describe the issue before submitting your report.");
      return;
    }
    message.success("Report submitted as Pending for Organizer review.");
    navigate("/learner/reports");
  };

  return (
    <LearnerPage className="report-content">
      <PageHeader
        eyebrow="COURSE / REPORT CONTENT"
        title="Report Course Content"
        subtitle="Tell your Organization which content needs review."
        back
      />
      <div className="report-content-body">
        <div className="report-content-card">
          <span>Reported item</span>
          <Input value={reportedItem} onChange={(event) => setReportedItem(event.target.value)} />
          <span>Content type</span>
          <Select<ReportContentType>
            value={contentType}
            options={contentTypeOptions}
            onChange={setContentType}
          />
          <span>Reason for report</span>
          <Input.TextArea
            rows={6}
            placeholder="Describe the issue with this content..."
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
          <InfoPanel title="Review process">
            The report is submitted as Pending for Organizer review.
          </InfoPanel>
          <div className="report-content-actions">
            <LearnerButton type="primary" onClick={submit}>
              Submit report
            </LearnerButton>
          </div>
        </div>
        <SectionCard title="What can be reported" className="report-content-side">
          <p>A Lesson, Video, Reading, Quiz content or Assignment instructions.</p>
        </SectionCard>
      </div>
    </LearnerPage>
  );
};

export default ReportContent;
