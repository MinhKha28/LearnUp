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
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
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
        else setError("Bạn không có quyền xem bài nộp của Assignment này.");
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
          eyebrow="BÀI NỘP"
          title="Bài nộp của Assignment"
          subtitle="Hãy chọn một Assignment trước."
        />
        <InfoPanel title="Cách mở danh sách bài nộp">
          Vào Khóa học của tôi, chọn một Assignment rồi chọn Bài nộp.
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
        eyebrow="BÀI NỘP / ASSIGNMENT"
        title={data?.assignment.title ?? "Bài nộp của Assignment"}
        subtitle={
          data?.assignment.peerReviewEnabled
            ? "Assignment này có bật chấm chéo."
            : "Assignment này không bật chấm chéo: bạn chấm mọi bài nộp."
        }
        back
      />
      {error && <Alert type="error" showIcon message={error} />}
      {data && !data.learnerNamesAvailable && (
        <Alert
          type="warning"
          showIcon
          message="Tạm thời không lấy được tên Learner, đang hiển thị mã Learner."
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
          placeholder="Tìm theo tên hoặc email Learner"
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
          value={minInput}
          onChange={setMinInput}
          onPressEnter={applyScore}
        />
        <span>đến</span>
        <InputNumber
          aria-label="Điểm cao nhất"
          min={0}
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
            Chỉ bài của một Learner
            {data?.items[0] ? `: ${personName(data.items[0].learner)}` : ""}
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
            <span>Learner</span>
            <span>Thời điểm nộp</span>
            <span>Lần nộp</span>
            <span>Trạng thái chấm</span>
            <span>Điểm</span>
            <span>Ghi chú</span>
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
              </button>
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
        Bài nộp mới nhất của mỗi Learner quyết định điểm Assignment được ghi
        nhận. Bài đã bị thay thế vẫn hiện để tham khảo. Bài chưa chốt điểm chưa
        có điểm cuối cùng nên không nằm trong kết quả lọc theo điểm.
      </InfoPanel>
    </InstructorPage>
  );
};

export default Submissions;
