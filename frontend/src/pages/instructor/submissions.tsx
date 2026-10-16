import { useEffect, useState } from "react";
import { Alert, Input, Pagination, Spin, Switch } from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  InfoPanel,
  InstructorPage,
  PageHeader,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import { getAssignmentSubmissionsAPI } from "@/services/instructor.submission.service";
import type { ISubmissionList } from "@/types/submission.types";
import {
  formatDateTime,
  gradingStatusView,
  interventionLabel,
  personName,
} from "@/utils/submission.labels";
import "./submissions.scss";

const PAGE_SIZE = 20;

const Submissions = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const assessmentId = params.get("assessmentId");
  const status = params.get("status") ?? undefined;
  const q = params.get("q") ?? undefined;
  const latestOnly = params.get("all") !== "1";
  const page = Number(params.get("page")) || 1;

  const [data, setData] = useState<ISubmissionList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState(q ?? "");

  useEffect(() => {
    if (!assessmentId) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getAssignmentSubmissionsAPI(assessmentId, {
          status,
          q,
          latestOnly,
          page,
          pageSize: PAGE_SIZE,
        });
        if (!active) return;
        if (res.data) setData(res.data);
        else setError("You cannot view the submissions of this Assignment.");
      } catch {
        if (active) setError("Could not connect to the server.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [assessmentId, status, q, latestOnly, page]);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) =>
      value === null ? next.delete(key) : next.set(key, value),
    );
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };

  if (!assessmentId) {
    return (
      <InstructorPage className="instructor-submissions">
        <PageHeader
          eyebrow="SUBMISSIONS"
          title="Assignment Submissions"
          subtitle="Choose an Assignment first."
        />
        <InfoPanel title="How to open submissions">
          Open a Course in My Courses, select an Assignment, then choose
          Submissions.
        </InfoPanel>
      </InstructorPage>
    );
  }

  const totalAll = data
    ? Object.values(data.statusCounts).reduce((sum, count) => sum + count, 0)
    : 0;

  return (
    <InstructorPage className="instructor-submissions">
      <PageHeader
        eyebrow="SUBMISSIONS / ASSIGNMENT"
        title={data?.assignment.title ?? "Assignment Submissions"}
        subtitle={
          data?.assignment.peerReviewEnabled
            ? "Peer review is on for this Assignment."
            : "Peer review is off: you grade every submission."
        }
        back
      />
      {error && <Alert type="error" showIcon message={error} />}
      {data && !data.learnerNamesAvailable && (
        <Alert
          type="warning"
          showIcon
          message="Learner names are unavailable right now. Showing learner IDs."
        />
      )}

      {data && (
        <div className="instructor-submission-chips">
          <button
            type="button"
            className={`instructor-submission-chip${!status ? " is-active" : ""}`}
            onClick={() => update({ status: null })}
          >
            <strong>{totalAll}</strong>
            <span>All</span>
          </button>
          {Object.entries(data.statusCounts).map(([key, count]) => (
            <button
              type="button"
              key={key}
              className={`instructor-submission-chip${status === key ? " is-active" : ""}`}
              onClick={() => update({ status: key })}
            >
              <strong>{count}</strong>
              <span>{gradingStatusView(key).label}</span>
            </button>
          ))}
        </div>
      )}

      <div className="instructor-submissions-toolbar">
        <Input.Search
          size="large"
          placeholder="Search learner name or email"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onSearch={(value) => update({ q: value.trim() || null })}
          allowClear
        />
        <label className="instructor-submissions-toggle">
          <Switch
            checked={!latestOnly}
            onChange={(checked) => update({ all: checked ? "1" : null })}
          />
          Show replaced submissions
        </label>
      </div>

      <Spin spinning={loading}>
        <div className="instructor-submissions-table">
          <div className="instructor-submissions-row instructor-submissions-head">
            <span>Learner</span>
            <span>Submitted</span>
            <span>Attempt</span>
            <span>Grading status</span>
            <span>Score</span>
            <span>Note</span>
          </div>
          {data?.items.map((item) => {
            const view = gradingStatusView(item.gradingStatus);
            return (
              <button
                type="button"
                key={item.id}
                className="instructor-submissions-row instructor-submissions-row-link"
                onClick={() => navigate(`/instructor/submissions/${item.id}`)}
              >
                <span className="instructor-submissions-learner">
                  <strong>{personName(item.learner)}</strong>
                  {item.learner.email && <small>{item.learner.email}</small>}
                </span>
                <span>{formatDateTime(item.submittedAt)}</span>
                <span>
                  #{item.submissionNumber}
                  {!item.isLatest && (
                    <small className="instructor-submissions-replaced">
                      replaced
                    </small>
                  )}
                </span>
                <span>
                  <StatusTag tone={view.tone}>{view.label}</StatusTag>
                </span>
                <span>{item.finalScore ?? "-"}</span>
                <span className="instructor-submissions-note">
                  {interventionLabel(item.interventionReason) ??
                    (item.reviews.total > 0
                      ? `${item.reviews.completed}/${item.reviews.total} reviews done`
                      : "-")}
                </span>
              </button>
            );
          })}
          {data && data.items.length === 0 && (
            <div className="instructor-submissions-empty">
              No submissions match these filters.
            </div>
          )}
        </div>
      </Spin>

      {data && data.total > PAGE_SIZE && (
        <Pagination
          className="instructor-submissions-pagination"
          current={page}
          pageSize={PAGE_SIZE}
          total={data.total}
          showSizeChanger={false}
          onChange={(next) => update({ page: String(next) })}
        />
      )}

      <InfoPanel title="Recorded score">
        The latest submission of each Learner determines the recorded
        Assignment score. Replaced submissions stay visible for reference.
      </InfoPanel>
    </InstructorPage>
  );
};

export default Submissions;
