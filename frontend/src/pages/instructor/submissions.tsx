import { SearchOutlined } from "@ant-design/icons";
import { Input } from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  type ISubmission,
  instructorSubmissions,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorPage, PageHeader } from "@/components/instructor/instructor.ui";
import "./submissions.scss";

const reviewStateLabel: Record<ISubmission["reviewState"], string> = {
  "awaiting-review": "Awaiting review",
  discrepancy: "Discrepancy",
  "insufficient-reviews": "Not enough reviews",
  "ready-to-publish": "Ready to publish",
  graded: "Graded",
};

const Submissions = () => {
  const navigate = useNavigate();
  const [query, setQuery] = useState("");

  const rows = useMemo(
    () =>
      instructorSubmissions.filter((submission) =>
        submission.learnerName.toLowerCase().includes(query.trim().toLowerCase()),
      ),
    [query],
  );

  const goToIntervention = (submission: ISubmission) => {
    switch (submission.reviewState) {
      case "discrepancy":
        navigate(`/instructor/submissions/${submission.id}/discrepancy`);
        return;
      case "insufficient-reviews":
        navigate(`/instructor/submissions/${submission.id}/grade`);
        return;
      case "ready-to-publish":
        navigate(`/instructor/submissions/${submission.id}/finalize`);
        return;
      default:
        navigate(`/instructor/submissions/${submission.id}`);
    }
  };

  return (
    <InstructorPage className="instructor-submissions">
      <PageHeader
        eyebrow="SUBMISSIONS / ASSIGNMENT"
        title="Assignment Submissions"
        subtitle="Safety Assignment / All submissions across cycles."
      />
      <div className="instructor-submissions-search">
        <Input
          size="large"
          prefix={<SearchOutlined />}
          placeholder="Learner · Grading status · Score · Intervention"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          allowClear
        />
      </div>
      <div className="instructor-submissions-table">
        <div className="instructor-submissions-row instructor-submissions-head">
          <span>Learner</span>
          <span>Submitted</span>
          <span>Cycle</span>
          <span>Review state</span>
          <span>Score</span>
          <span>Intervention</span>
        </div>
        {rows.map((submission) => (
          <div className="instructor-submissions-row" key={submission.id}>
            <button
              type="button"
              className="instructor-submissions-link"
              onClick={() => navigate(`/instructor/submissions/${submission.id}`)}
            >
              {submission.learnerName}
            </button>
            <span>[Date]</span>
            <span>[Cycle]</span>
            <span>{reviewStateLabel[submission.reviewState]}</span>
            <span>{submission.scoreLabel}</span>
            {submission.interventionLabel === "—" ||
            submission.interventionLabel === "Published" ||
            submission.interventionLabel === "Draft saved" ? (
              <span className="instructor-submissions-link instructor-submissions-link-muted">
                {submission.interventionLabel}
              </span>
            ) : (
              <button
                type="button"
                className="instructor-submissions-link"
                onClick={() => goToIntervention(submission)}
              >
                {submission.interventionLabel}
              </button>
            )}
          </div>
        ))}
        {rows.length === 0 && (
          <div className="instructor-submissions-row">
            <span>No Submissions match this search.</span>
            <span />
            <span />
            <span />
            <span />
            <span />
          </div>
        )}
      </div>
      <InfoPanel title="Instructor responsibility">
        You publish the final score even when Peer Review is complete.
      </InfoPanel>
    </InstructorPage>
  );
};

export default Submissions;
