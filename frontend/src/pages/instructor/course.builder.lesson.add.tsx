import { BookOutlined } from "@ant-design/icons";
import { Input, message } from "antd";
import { useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InstructorButton } from "@/components/instructor/instructor.ui";
import { createCourseLessonAPI } from "@/services/course.service";

import "./course.builder.scss";

const CourseBuilderLessonAdd = () => {
  const { courseId, moduleId } = useParams();
  const navigate = useNavigate();
  const { structure, refetchStructure } =
    useOutletContext<ICourseBuilderOutletContext>();

  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [saving, setSaving] = useState(false);

  if (!courseId || !moduleId) return null;

  const base = `/instructor/courses/${courseId}/builder`;
  const isSubmitted = structure.course.status === "Submitted";
  const cannotEdit = structure.structureLocked || isSubmitted;
  const module = structure.modules.find((item) => item.id === moduleId);

  if (!module) {
    return (
      <div className="builder-create-page">
        <div className="builder-create-card">
          <p>Không tìm thấy chương.</p>

          <div className="builder-create-actions">
            <InstructorButton onClick={() => navigate(base)}>
              Quay lại cấu trúc khóa học
            </InstructorButton>
          </div>
        </div>
      </div>
    );
  }

  const handleSave = async () => {
    if (saving) return;

    const normalizedTitle = title.trim();
    const normalizedContent = content.trim();

    if (!normalizedTitle) {
      message.warning("Nhập tiêu đề bài học.");
      return;
    }

    if (!normalizedContent) {
      message.warning("Nhập nội dung bài học.");
      return;
    }

    if (cannotEdit) {
      message.error(isSubmitted ? "Thu hồi khóa học trước khi chỉnh sửa." : structure.lockReason || "Cấu trúc khóa học đã bị khóa.");
      return;
    }

    try {
      setSaving(true);

      const response = await createCourseLessonAPI(courseId, moduleId, {
        title: normalizedTitle,
        content: normalizedContent,
      });

      if (!response.data) {
        message.error(response.message || "Không thể tạo bài học.");
        return;
      }

      message.success("Đã tạo bài học.");

      await refetchStructure();

      navigate(base, {
        replace: true,
      });
    } catch (error) {
      console.error("Create Lesson error:", error);
      message.error("Không thể tạo bài học.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="builder-create-page">
      <div className="builder-create-header">
        <span className="builder-editor-eyebrow">Cấu trúc khóa học</span>
        <h1>Thêm bài học</h1>

        <p>
          Thêm bài học mới vào <strong>{module.title}</strong>.
        </p>
      </div>

      <div className="builder-create-card">
        <div className="builder-create-card-header">
          <div className="builder-create-icon">
            <BookOutlined />
          </div>

          <div>
            <h2>Thông tin bài học</h2>
            <p>Nhập tên và nội dung giới thiệu bài học.</p>
          </div>
        </div>

        <div className="builder-create-form">
          <label htmlFor="lesson-title">Tên bài học</label>

          <Input
            id="lesson-title"
            size="large"
            maxLength={200}
            showCount
            autoFocus
            placeholder="Ví dụ: Giới thiệu Spring Boot"
            value={title}
            disabled={saving || cannotEdit}
            onChange={(event) => setTitle(event.target.value)}
          />

          <label
            htmlFor="lesson-content"
            className="builder-create-label-spaced"
          >
            Nội dung bài học
          </label>

          <Input.TextArea
            id="lesson-content"
            rows={7}
            maxLength={20000}
            showCount
            placeholder="Nhập nội dung giới thiệu bài học..."
            value={content}
            disabled={saving || cannotEdit}
            onChange={(event) => setContent(event.target.value)}
          />

          <p className="builder-create-help">
            Bài học mới sẽ được thêm vào cuối chương.
          </p>
        </div>

        <div className="builder-create-actions">
          <InstructorButton onClick={() => navigate(base)} disabled={saving}>
            Hủy
          </InstructorButton>

          <InstructorButton
            type="primary"
            onClick={() => void handleSave()}
            disabled={
              saving ||
              cannotEdit ||
              !title.trim() ||
              !content.trim()
            }
          >
            {saving ? "Đang lưu..." : "Thêm bài học"}
          </InstructorButton>
        </div>
      </div>
    </div>
  );
};

export default CourseBuilderLessonAdd;
