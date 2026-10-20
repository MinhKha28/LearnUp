import { ArrowLeftOutlined, ArrowRightOutlined } from "@ant-design/icons";
import { Tooltip } from "antd";
import { useEffect } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";

import { LearnerSkeleton } from "@/components/learner/learner.states";
import {
  LearnerButton,
  LearnerPage,
  StatusTag,
} from "@/components/learner/learner.ui";
import { LearningError } from "@/components/learner/learning.error";
import { LessonMarkdown } from "@/components/learner/lesson.markdown";
import { useApiQuery } from "@/hooks/use.api.query";
import { fetchLessonDetail } from "@/services/learning.service";
import type { LessonDetailData } from "@/types/learning.types";
import { buildMaterialRow, completionMark } from "@/utils/curriculum.view";
import { LEARNER_ROUTES } from "@/utils/learner.routes";
import "./lesson.detail.scss";

const MATERIAL_SOON = "Học liệu Bài đọc sẽ có ở phiên bản sau";

const LessonBody = ({
  data,
  enrollmentId,
}: {
  data: LessonDetailData;
  enrollmentId: string;
}) => {
  const navigate = useNavigate();
  const { lesson, materials, previousLesson, nextLesson } = data;
  const mark = completionMark(lesson.completed);
  const hasContent = lesson.content !== null && lesson.content.trim() !== "";

  return (
    <>
      <header className="lesson-detail-header">
        <h1>{lesson.title}</h1>
        <div className="lesson-detail-tags">
          {lesson.isRequired && <StatusTag tone="warning">Bắt buộc</StatusTag>}
          {mark && <StatusTag tone={mark.tone}>{mark.label}</StatusTag>}
        </div>
      </header>

      {/* Lesson không có nội dung: bỏ hẳn phần nội dung (luồng 3a) */}
      {hasContent && (
        <section className="lesson-detail-card" aria-label="Nội dung Bài học">
          <LessonMarkdown content={lesson.content ?? ""} />
        </section>
      )}

      <section className="lesson-detail-card">
        <h2>Học liệu</h2>
        {materials.length === 0 ? (
          <p className="lesson-detail-empty">Bài học này chưa có học liệu</p>
        ) : (
          <ol className="lesson-detail-materials">
            {materials.map((material) => {
              const row = buildMaterialRow(material);
              return (
                <li key={row.key} className="lesson-detail-material">
                  <div className="lesson-detail-material-body">
                    <strong>{row.title}</strong>
                    <div className="lesson-detail-material-meta">
                      <StatusTag tone="neutral">{row.typeLabel}</StatusTag>
                      {row.isRequired && (
                        <StatusTag tone="warning">Bắt buộc</StatusTag>
                      )}
                      {row.mark && (
                        <StatusTag tone={row.mark.tone}>
                          {row.mark.label}
                        </StatusTag>
                      )}
                      {row.duration && <span>{row.duration}</span>}
                    </div>
                  </div>
                  {/* Nút bị vô hiệu không nhận sự kiện chuột, bọc span để tooltip vẫn hiện */}
                  <Tooltip
                    title={
                      material.materialType === "Video"
                        ? undefined
                        : MATERIAL_SOON
                    }
                  >
                    <span className="lesson-detail-material-action">
                      <LearnerButton
                        disabled={material.materialType !== "Video"}
                        onClick={() =>
                          navigate(
                            `/learner/courses/${enrollmentId}/lessons/${lesson.lessonId}/resources/${material.materialId}`,
                          )
                        }
                        aria-label={`Mở học liệu ${row.title}`}
                      >
                        Mở học liệu
                      </LearnerButton>
                    </span>
                  </Tooltip>
                </li>
              );
            })}
          </ol>
        )}
      </section>

      {(previousLesson || nextLesson) && (
        <nav
          className="lesson-detail-neighbors"
          aria-label="Bài học trước và sau"
        >
          {previousLesson ? (
            <LearnerButton
              icon={<ArrowLeftOutlined />}
              onClick={() =>
                navigate(
                  LEARNER_ROUTES.lesson(enrollmentId, previousLesson.lessonId),
                )
              }
            >
              {previousLesson.title}
            </LearnerButton>
          ) : (
            <span />
          )}
          {nextLesson && (
            <LearnerButton
              type="primary"
              icon={<ArrowRightOutlined />}
              iconPosition="end"
              onClick={() =>
                navigate(
                  LEARNER_ROUTES.lesson(enrollmentId, nextLesson.lessonId),
                )
              }
            >
              {nextLesson.title}
            </LearnerButton>
          )}
        </nav>
      )}
    </>
  );
};

const LessonDetail = () => {
  const { enrollmentId = "", lessonId = "" } = useParams();
  const query = useApiQuery(
    (signal) => fetchLessonDetail(enrollmentId, lessonId, signal),
    [enrollmentId, lessonId],
  );

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [lessonId]);
  useEffect(() => {
    window.addEventListener("learning-progress", query.reload);
    return () => window.removeEventListener("learning-progress", query.reload);
  }, [query.reload]);

  return (
    <LearnerPage className="lesson-detail">
      <Link
        className="lesson-detail-back"
        to={LEARNER_ROUTES.curriculum(enrollmentId)}
      >
        <ArrowLeftOutlined aria-hidden="true" />
        <span>Chương trình học</span>
      </Link>
      {query.status === "loading" && <LearnerSkeleton variant="detail" />}
      {query.status === "error" && (
        <LearningError
          error={query.error}
          context="lesson"
          enrollmentId={enrollmentId}
          onRetry={query.reload}
        />
      )}
      {query.status === "success" && (
        <LessonBody data={query.data} enrollmentId={enrollmentId} />
      )}
    </LearnerPage>
  );
};

export default LessonDetail;
