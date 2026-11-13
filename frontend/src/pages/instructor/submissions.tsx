import { useEffect, useState } from "react";
import {
  Alert,
  Button,
  Input,
  InputNumber,
  Pagination,
  Spin,
  Switch,
  Tag,
} from "antd";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  InfoPanel,
  InstructorPage,
  PageHeader,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import SubmissionAssignmentPicker from "@/components/instructor/submission.assignment.picker";
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

const numberParam = (value: string | null) => {
  if (value === null || value.trim() === "") return undefined;
  const parsed = Number(value);
  // a score is 0-100 (BR-202); a value outside it can never match, so it is not a filter
  return Number.isFinite(parsed) && parsed >= 0 && parsed <= 100
    ? parsed
    : undefined;
};

const Submissions = () => {
  const navigate = useNavigate();
  const [params, setParams] = useSearchParams();
  const assessmentId = params.get("assessmentId");
  const status = params.get("status") ?? undefined;
  const q = params.get("q") ?? undefined;
  const learnerId = params.get("learnerId") ?? undefined;
  const needsIntervention = params.get("needs") === "1";
  const minScore = numberParam(params.get("min"));
  const maxScore = numberParam(params.get("max"));
  const latestOnly = params.get("all") !== "1";
  const page = Number(params.get("page")) || 1;
  const scoreRangeInvalid =
    minScore !== undefined && maxScore !== undefined && minScore > maxScore;

  const [data, setData] = useState<ISubmissionList | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [keyword, setKeyword] = useState(q ?? "");
  const [minInput, setMinInput] = useState<number | null>(minScore ?? null);
  const [maxInput, setMaxInput] = useState<number | null>(maxScore ?? null);
  // The name on the tag of the Learner filter. It is read from a row while one is on the page and kept after that, so
  // the tag still names the Learner when the other filters leave no row.
  const [learnerName, setLearnerName] = useState<string | null>(null);

  useEffect(() => {
    setLearnerName(null);
  }, [learnerId]);
  useEffect(() => {
    if (!learnerId) return;
    const row = data?.items.find((item) => item.learner.id === learnerId);
    if (row) setLearnerName(personName(row.learner));
  }, [learnerId, data]);

  useEffect(() => {
    if (!assessmentId || scoreRangeInvalid) return;
    let active = true;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await getAssignmentSubmissionsAPI(assessmentId, {
          status,
          q,
          learnerId,
          needsIntervention: needsIntervention ? true : undefined,
          minScore,
          maxScore,
          latestOnly,
          page,
          pageSize: PAGE_SIZE,
        });
        if (!active) return;
        if (res.data) setData(res.data);
        else setError("Bạn không có quyền xem bài nộp của bài tập này.");
      } catch {
        if (active) setError("Không kết nối được với máy chủ.");
      } finally {
        if (active) setLoading(false);
      }
    };
    load();
    return () => {
      active = false;
    };
  }, [
    assessmentId,
    status,
    q,
    learnerId,
    needsIntervention,
    minScore,
    maxScore,
    scoreRangeInvalid,
    latestOnly,
    page,
  ]);

  const update = (changes: Record<string, string | null>) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) =>
      value === null ? next.delete(key) : next.set(key, value),
    );
    if (!("page" in changes)) next.delete("page");
    setParams(next);
  };

  const applyScore = () =>
    update({
      min: minInput === null ? null : String(minInput),
      max: maxInput === null ? null : String(maxInput),
    });

  const filtering = Boolean(
    status ||
    q ||
    learnerId ||
    needsIntervention ||
    minScore !== undefined ||
    maxScore !== undefined,
  );

  const clearFilters = () => {
    setKeyword("");
    setMinInput(null);
    setMaxInput(null);
    update({
      status: null,
      q: null,
      learnerId: null,
      needs: null,
      min: null,
      max: null,
    });
  };

  if (!assessmentId) {
    return (
      <InstructorPage className="instructor-submissions">
        <PageHeader
          eyebrow="Bài nộp"
          title="Bài nộp của bài tập"
          subtitle="Chọn khóa học và bài tập để xem bài nộp."
        />
        <SubmissionAssignmentPicker
          onPick={(id) => update({ assessmentId: id })}
        />
        <InfoPanel title="Cách mở danh sách bài nộp">
          Chọn khóa học, rồi chọn bài tập. Bạn cũng có thể mở từ trang chi tiết
          bài tập bằng nút Bài nộp.
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
        eyebrow="Bài nộp / Bài tập"
        title={data?.assignment.title ?? "Bài nộp của bài tập"}
        subtitle={
          data?.assignment.peerReviewEnabled
            ? "Bài tập này có bật chấm chéo."
            : "Bài tập này không bật chấm chéo: bạn chấm mọi bài nộp."
        }
        back
      />
      {error && <Alert type="error" showIcon message={error} />}
      {data && !data.learnerNamesAvailable && (
        <Alert
          type="warning"
          showIcon
          message="Tạm thời không lấy được tên học viên, đang hiển thị mã học viên."
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
            <span>Tất cả</span>
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
          placeholder="Tìm theo tên hoặc email học viên"
          value={keyword}
          onChange={(event) => setKeyword(event.target.value)}
          onSearch={(value) => update({ q: value.trim() || null })}
          allowClear
        />
        <label className="instructor-submissions-toggle">
          <Switch
            checked={needsIntervention}
            onChange={(checked) => update({ needs: checked ? "1" : null })}
          />
          Chỉ bài cần tôi chấm
        </label>
        <label className="instructor-submissions-toggle">
          <Switch
            checked={!latestOnly}
            onChange={(checked) => update({ all: checked ? "1" : null })}
          />
          Hiện cả bài đã được thay thế
        </label>
      </div>

      <div className="instructor-submissions-toolbar instructor-submissions-score">
        <span>Điểm cuối cùng từ</span>
        <InputNumber
          aria-label="Điểm thấp nhất"
          min={0}
          max={100}
          value={minInput}
          onChange={setMinInput}
          onPressEnter={applyScore}
        />
        <span>đến</span>
        <InputNumber
          aria-label="Điểm cao nhất"
          min={0}
          max={100}
          value={maxInput}
          onChange={setMaxInput}
          onPressEnter={applyScore}
        />
        <Button onClick={applyScore}>Lọc theo điểm</Button>
        {filtering && <Button onClick={clearFilters}>Xóa bộ lọc</Button>}
      </div>

      {learnerId && (
        <div className="instructor-submissions-active">
          <Tag closable onClose={() => update({ learnerId: null })}>
            Chỉ bài của một học viên:{" "}
            {learnerName ?? `Học viên ${learnerId.slice(-4).toUpperCase()}`}
          </Tag>
        </div>
      )}
      {scoreRangeInvalid && (
        <Alert
          type="warning"
          showIcon
          message="Điểm thấp nhất đang lớn hơn điểm cao nhất, hãy sửa lại khoảng điểm."
        />
      )}

      <Spin spinning={loading}>
        <div className="instructor-submissions-table">
          <div className="instructor-submissions-row instructor-submissions-head">
            <span>Học viên</span>
            <span>Thời điểm nộp</span>
            <span>Lần nộp</span>
            <span>Trạng thái chấm</span>
            <span>Điểm</span>
            <span>Ghi chú</span>
          </div>
          {data?.items.map((item) => {
            const view = gradingStatusView(item.gradingStatus);
            return (
              <div
                role="link"
                tabIndex={0}
                key={item.id}
                className="instructor-submissions-row instructor-submissions-row-link"
                onClick={() => navigate(`/instructor/submissions/${item.id}`)}
                onKeyDown={(event) => {
                  if (event.target !== event.currentTarget) return;
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    navigate(`/instructor/submissions/${item.id}`);
                  }
                }}
              >
                <span className="instructor-submissions-learner">
                  <button
                    type="button"
                    className="instructor-submissions-learner-filter"
                    title="Chỉ xem bài của học viên này"
                    onClick={(event) => {
                      event.stopPropagation();
                      update({ learnerId: item.learner.id });
                    }}
                  >
                    {personName(item.learner)}
                  </button>
                  {item.learner.email && <small>{item.learner.email}</small>}
                </span>
                <span>{formatDateTime(item.submittedAt)}</span>
                <span>
                  #{item.submissionNumber}
                  {!item.isLatest && (
                    <small className="instructor-submissions-replaced">
                      đã thay thế
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
                      ? `${item.reviews.completed}/${item.reviews.total} lượt chấm xong`
                      : "-")}
                </span>
              </div>
            );
          })}
          {data && data.items.length === 0 && (
            <div className="instructor-submissions-empty">
              Không có bài nộp nào khớp với bộ lọc.
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

      <InfoPanel title="Điểm được ghi nhận">
        Bài nộp mới nhất của mỗi học viên quyết định điểm bài tập được ghi
        nhận. Bài đã bị thay thế vẫn hiện để tham khảo. Bài chưa chốt điểm chưa
        có điểm cuối cùng nên không nằm trong kết quả lọc theo điểm.
      </InfoPanel>
    </InstructorPage>
  );
};

export default Submissions;
