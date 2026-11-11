import axios from "axios";
import { Alert, Input, message, Skeleton } from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  InfoPanel,
  InstructorButton,
  InstructorPage,
} from "@/components/instructor/instructor.ui";

import { LessonMarkdown } from "@/components/learner/lesson.markdown";

import {
  fetchCourseLessonDetailAPI,
  fetchLessonContentEditabilityAPI,
  updateLessonContentAPI,
} from "@/services/course.service";

import type {
  IInstructorLessonDetail,
  ILessonContentEditability,
} from "@/types/course.types";

import "./course.builder.scss";

// Đọc thông báo lỗi từ Backend.
const getErrorMessage = (error: unknown): string => {
  if (axios.isAxiosError(error)) {
    const body = error.response?.data as
      | {
          error?: { message?: string | string[] };
          message?: string | string[];
        }
      | undefined;

    const detail = body?.error?.message ?? body?.message;

    if (typeof detail === "string") {
      return detail;
    }

    if (Array.isArray(detail)) {
      return detail.join(", ");
    }
  }

  if (error instanceof Error) {
    return error.message;
  }

  return "Không thể cập nhật nội dung bài học.";
};

const CourseBuilderLessonContentEdit = () => {
  const { courseId, lessonId } = useParams();
  const navigate = useNavigate();

  const [lesson, setLesson] = useState<IInstructorLessonDetail | null>(null);

  const [editability, setEditability] =
    useState<ILessonContentEditability | null>(null);

  const [content, setContent] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const detailUrl = `/instructor/courses/${courseId}/builder/lessons/${lessonId}`;

  // 1. Tải Lesson Detail và quyền cập nhật.
  useEffect(() => {
    const controller = new AbortController();

    const loadData = async () => {
      setLoading(true);
      setErrorMessage("");
      setLesson(null);
      setEditability(null);

      if (!courseId || !lessonId) {
        setErrorMessage("Thiếu mã khóa học hoặc bài học.");
        setLoading(false);
        return;
      }

      try {
        const [lessonResponse, editabilityResponse] = await Promise.all([
          fetchCourseLessonDetailAPI(courseId, lessonId, controller.signal),
          fetchLessonContentEditabilityAPI(
            courseId,
            lessonId,
            controller.signal,
          ),
        ]);

        if (!lessonResponse.data || !editabilityResponse.data) {
          throw new Error("Không thể tải nội dung bài học.");
        }

        if (controller.signal.aborted) return;

        setLesson(lessonResponse.data);
        setEditability(editabilityResponse.data);
        setContent(lessonResponse.data.lesson.content);
      } catch (error) {
        if (controller.signal.aborted) return;

        console.error("Load Lesson content error:", error);
        setErrorMessage(getErrorMessage(error));
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
        }
      }
    };

    void loadData();

    return () => {
      controller.abort();
    };
  }, [courseId, lessonId]);

  // 2. Lưu nội dung Lesson.
  const handleSave = async () => {
    if (!courseId || !lessonId || !lesson || !editability?.canEdit || saving) {
      return;
    }

    if (!content.trim()) {
      message.error("Nội dung bài học không được để trống.");
      return;
    }

    if (content.length > 20000) {
      message.error("Nội dung bài học không được vượt quá 20.000 ký tự.");
      return;
    }

    if (content === lesson.lesson.content) {
      message.info("Không có thay đổi để lưu.");
      return;
    }

    setSaving(true);

    try {
      const response = await updateLessonContentAPI(courseId, lessonId, {
        content,
      });

      if (!response.data) {
        throw new Error(response.message || "Không thể cập nhật nội dung bài học.");
      }

      message.success("Đã cập nhật nội dung bài học.");
      navigate(detailUrl);
    } catch (error) {
      console.error("Save Lesson content error:", error);
      message.error(getErrorMessage(error));

      // Nếu Backend trả 409, kiểm tra lại quyền chỉnh sửa.
      if (axios.isAxiosError(error) && error.response?.status === 409) {
        try {
          const result = await fetchLessonContentEditabilityAPI(
            courseId,
            lessonId,
          );

          if (result.data) {
            setEditability(result.data);
          }
        } catch {
          // Không tự bật lại quyền Edit khi không kiểm tra được.
          setEditability(null);
        }
      }
    } finally {
      setSaving(false);
    }
  };

  // 3. Loading state.
  if (loading) {
    return (
      <InstructorPage className="builder-page">
        <Skeleton active />
      </InstructorPage>
    );
  }

  // 4. Error state.
  if (!lesson || !editability) {
    return (
      <InstructorPage className="builder-page">
        <h1>Không thể tải nội dung bài học</h1>

        <Alert
          type="error"
          showIcon
          message={errorMessage || "Không thể tải bài học."}
        />

        <div className="builder-actions">
          <InstructorButton onClick={() => navigate(detailUrl)}>
            Back to Lesson
          </InstructorButton>
        </div>
      </InstructorPage>
    );
  }

  const cannotEdit = !editability.canEdit;
  const hasChanges = content !== lesson.lesson.content;

  const lockedMessage =
    editability.reason === "COMPLETED"
      ? "Đã có ít nhất một học viên hoàn thành bài học nên không thể thay đổi nội dung."
      : editability.reason === "SUBMITTED"
        ? "Khóa học đang chờ phê duyệt. Hãy thu hồi trước khi chỉnh sửa."
        : "";

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">
        Course Builder / Lesson / Edit Content
      </span>

      <div className="builder-hero">
        <h1>Chỉnh sửa nội dung bài học</h1>
        <p>
          {lesson.module.title} / {lesson.lesson.title}
        </p>
      </div>

      {cannotEdit && (
        <Alert
          type="warning"
          showIcon
          message="Nội dung bài học hiện không thể chỉnh sửa"
          description={lockedMessage}
          style={{ marginBottom: 20 }}
        />
      )}

      <div className="builder-grid">
        {/* Form nhập nội dung */}
        <div className="builder-update-card">
          <h2>Giới thiệu bài học</h2>

          <p className="builder-lesson-intro">
            Edit the introductory text of this Lesson. Markdown is supported.
          </p>

          <Input.TextArea
            className="builder-textarea"
            value={content}
            onChange={(event) => setContent(event.target.value)}
            rows={14}
            maxLength={20000}
            showCount
            disabled={cannotEdit || saving}
            placeholder="Nhập nội dung giới thiệu bài học..."
          />

          <div className="builder-actions">
            <InstructorButton
              disabled={saving}
              onClick={() => navigate(detailUrl)}
            >
              Cancel
            </InstructorButton>

            <InstructorButton
              type="primary"
              loading={saving}
              disabled={cannotEdit || !hasChanges || !content.trim()}
              onClick={() => void handleSave()}
            >
              Save Content
            </InstructorButton>
          </div>
        </div>

        {/* Cột bên phải */}
        <div className="builder-side">
          <InfoPanel title="Quy tắc chỉnh sửa">
            Lesson content can be updated only when no Learner has completed the
            Lesson.
          </InfoPanel>

          <InfoPanel title="BR-292">
            The introduction is not a Required learning material and does not
            contribute to estimated learning duration.
          </InfoPanel>
        </div>
      </div>

      {/* Preview Markdown */}
      <div className="builder-update-card" style={{ marginTop: 20 }}>
        <h2>Xem trước nội dung</h2>

        {content.trim() ? (
          <LessonMarkdown content={content} />
        ) : (
          <p className="builder-lesson-intro">Chưa có nội dung để xem trước.</p>
        )}
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderLessonContentEdit;
