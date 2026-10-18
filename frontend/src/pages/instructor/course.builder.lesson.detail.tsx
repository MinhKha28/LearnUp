import {
  ArrowLeftOutlined,
  FilePdfOutlined,
  FileTextOutlined,
  VideoCameraOutlined,
} from "@ant-design/icons";
import { Alert, Spin } from "antd";
import { useNavigate, useParams } from "react-router-dom";

import {
  InstructorButton,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import { LessonMarkdown } from "@/components/learner/lesson.markdown";
import { useApiQuery } from "@/hooks/use.api.query";
import { fetchCourseLessonDetailAPI } from "@/services/course.service";

import type {
  IInstructorLessonDetail,
  IInstructorLessonMaterial,
} from "@/types/course.types";

import "./course.builder.lesson.detail.scss";

// Hiển thị dung lượng file từ chuỗi sizeBytes.
const formatFileSize = (sizeBytes: string): string => {
  const bytes = Number(sizeBytes);

  if (!Number.isFinite(bytes) || bytes < 0) {
    return "Unknown size";
  }

  if (bytes < 1024) {
    return `${bytes} B`;
  }

  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }

  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// Hiển thị thời lượng Video nếu MediaFile có dữ liệu.
const formatDuration = (seconds: number | null): string | null => {
  if (seconds === null) return null;

  const minutes = Math.ceil(seconds / 60);
  return `${minutes} min`;
};

// Chọn icon tương ứng loại Material.
const MaterialIcon = ({ type }: { type: string }) => {
  if (type === "Video") {
    return <VideoCameraOutlined />;
  }

  if (type === "Reading") {
    return <FilePdfOutlined />;
  }

  return <FileTextOutlined />;
};

// Một dòng Material trong danh sách.
const MaterialRow = ({ material }: { material: IInstructorLessonMaterial }) => {
  const duration = formatDuration(material.file.durationSeconds);

  return (
    <div className="instructor-lesson-material">
      <div className="instructor-lesson-material-icon">
        <MaterialIcon type={material.materialType} />
      </div>

      <div className="instructor-lesson-material-body">
        <strong>{material.title}</strong>

        <div className="instructor-lesson-material-tags">
          <StatusTag tone="neutral">{material.materialType}</StatusTag>

          <StatusTag tone={material.isRequired ? "warning" : "neutral"}>
            {material.isRequired ? "Required" : "Optional"}
          </StatusTag>

          {material.disabledAt && <StatusTag tone="error">Disabled</StatusTag>}

          {material.file.status !== "Ready" && (
            <StatusTag tone="warning">{material.file.status}</StatusTag>
          )}

          {material.file.releasedAt && (
            <StatusTag tone="error">File released</StatusTag>
          )}
        </div>

        <div className="instructor-lesson-material-meta">
          <span>{material.file.originalFilename}</span>
          <span>{formatFileSize(material.file.sizeBytes)}</span>

          {duration && <span>{duration}</span>}

          {material.file.wordCount !== null && (
            <span>{material.file.wordCount.toLocaleString()} words</span>
          )}
        </div>
      </div>
    </div>
  );
};

// Phần nội dung hiển thị sau khi API thành công.
const InstructorLessonBody = ({ data }: { data: IInstructorLessonDetail }) => {
  const navigate = useNavigate();

  const { course, module, lesson, materials } = data;
  const base = `/instructor/courses/${course.id}/builder`;

  const hasContent = lesson.content.trim().length > 0;

  const requiredCount = materials.filter(
    (material) => material.isRequired,
  ).length;

  const videoCount = materials.filter(
    (material) => material.materialType === "Video",
  ).length;

  const readingCount = materials.filter(
    (material) => material.materialType === "Reading",
  ).length;

  return (
    <>
      <div className="instructor-lesson-header">
        <div>
          <span className="instructor-lesson-eyebrow">
            COURSE BUILDER / LESSON DETAIL
          </span>

          <h1>{lesson.title}</h1>

          <p>
            Module {module.position}: {module.title}
            {" · "}
            Lesson {lesson.position}
          </p>

          <div className="instructor-lesson-tags">
            <StatusTag tone={lesson.required ? "warning" : "neutral"}>
              {lesson.required ? "Required" : "Optional"}
            </StatusTag>

            <StatusTag tone="neutral">{materials.length} materials</StatusTag>

            {lesson.disabledAt && (
              <StatusTag tone="error">Lesson Disabled</StatusTag>
            )}
          </div>
        </div>

        <div className="instructor-lesson-header-actions">
          <InstructorButton
            onClick={() =>
              navigate(`${base}/lessons/${lesson.id}/content/edit`)
            }
          >
            Edit Lesson Content
          </InstructorButton>

          <InstructorButton
            icon={<ArrowLeftOutlined />}
            onClick={() => navigate(base)}
          >
            Back to Structure
          </InstructorButton>
        </div>
      </div>

      <div className="instructor-lesson-layout">
        <div className="instructor-lesson-main">
          {/* Lesson Content */}
          <section className="instructor-lesson-card">
            <h2>Lesson content</h2>

            {hasContent ? (
              <LessonMarkdown content={lesson.content} />
            ) : (
              <p className="instructor-lesson-empty">
                No Lesson content has been added yet.
              </p>
            )}
          </section>

          {/* Learning Materials */}
          <section className="instructor-lesson-card">
            <div className="instructor-lesson-card-heading">
              <h2>Learning materials</h2>
              <span>{materials.length} total</span>
            </div>

            {materials.length === 0 ? (
              <p className="instructor-lesson-empty">
                No learning materials have been added to this Lesson yet.
              </p>
            ) : (
              <div className="instructor-lesson-materials">
                {materials.map((material) => (
                  <MaterialRow key={material.id} material={material} />
                ))}
              </div>
            )}
          </section>
        </div>

        {/* Information sidebar */}
        <aside className="instructor-lesson-sidebar">
          <section className="instructor-lesson-card">
            <h2>Lesson overview</h2>

            <div className="instructor-lesson-info">
              <div>
                <span>Course</span>
                <strong>{course.name}</strong>
              </div>

              <div>
                <span>Course status</span>
                <StatusTag
                  tone={
                    course.status === "Published"
                      ? "success"
                      : course.status === "Submitted"
                        ? "warning"
                        : "neutral"
                  }
                >
                  {course.status}
                </StatusTag>
              </div>

              <div>
                <span>Course structure</span>
                <strong>{course.locked ? "Locked" : "Unlocked"}</strong>
              </div>

              <div>
                <span>Required materials</span>
                <strong>{requiredCount}</strong>
              </div>

              <div>
                <span>Videos</span>
                <strong>{videoCount}</strong>
              </div>

              <div>
                <span>Readings</span>
                <strong>{readingCount}</strong>
              </div>
            </div>
          </section>
        </aside>
      </div>
    </>
  );
};

const CourseBuilderLessonDetail = () => {
  const { courseId = "", lessonId = "" } = useParams();

  // Hook có sẵn: loading, success, error và reload.
  const query = useApiQuery(
    async (signal) => {
      const response = await fetchCourseLessonDetailAPI(
        courseId,
        lessonId,
        signal,
      );

      if (!response.data) {
        throw new Error(response.message || "Unable to load Lesson details.");
      }

      return response.data;
    },
    [courseId, lessonId],
  );

  return (
    <div className="instructor-lesson-detail">
      {query.status === "loading" && (
        <div className="instructor-lesson-loading">
          <Spin size="large" />
          <span>Loading Lesson details...</span>
        </div>
      )}

      {query.status === "error" && (
        <div className="instructor-lesson-error">
          <Alert
            type="error"
            showIcon
            message={
              query.error.status === 404
                ? "Lesson not found"
                : "Unable to load Lesson details"
            }
            description={
              query.error.status === 404
                ? "This Lesson does not exist or you do not have access."
                : "Please check your connection and try again."
            }
          />

          <InstructorButton onClick={query.reload}>Try again</InstructorButton>
        </div>
      )}

      {query.status === "success" && <InstructorLessonBody data={query.data} />}
    </div>
  );
};

export default CourseBuilderLessonDetail;
