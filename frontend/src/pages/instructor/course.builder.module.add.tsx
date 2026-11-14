import { PlusOutlined } from "@ant-design/icons";
import { Input, message } from "antd";
import { useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InstructorButton } from "@/components/instructor/instructor.ui";
import { createCourseModuleAPI } from "@/services/course.service";

import "./course.builder.scss";

const CourseBuilderModuleAdd = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const { structure, refetchStructure } =
    useOutletContext<ICourseBuilderOutletContext>();

  const [title, setTitle] = useState("");
  const [saving, setSaving] = useState(false);

  if (!courseId) return null;

  const base = `/instructor/courses/${courseId}/builder`;
  const isSubmitted = structure.course.status === "Submitted";
  const cannotEdit = structure.structureLocked || isSubmitted;

  const handleSave = async () => {
    if (saving) return;

    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      message.warning("Nhập tiêu đề chương.");
      return;
    }

    if (cannotEdit) {
      message.error(isSubmitted ? "Thu hồi khóa học trước khi chỉnh sửa." : structure.lockReason || "Cấu trúc khóa học đã khóa.");
      return;
    }

    try {
      setSaving(true);

      const response = await createCourseModuleAPI(courseId, {
        title: normalizedTitle,
      });

      if (!response.data) {
        message.error(response.message || "Không thể tạo chương.");
        return;
      }

      message.success("Đã tạo chương.");
      await refetchStructure();

      navigate(base, {
        replace: true,
      });
    } catch (error) {
      console.error("Create Module error:", error);
      message.error("Không thể tạo chương.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="builder-module-add-page">
      <div className="builder-module-add-header">
        <span className="builder-editor-eyebrow">Cấu trúc khóa học</span>
        <h1>Thêm chương</h1>
        <p>Tạo chương mới ở cuối khóa học.</p>
      </div>

      <div className="builder-module-add-card">
        <div className="builder-module-add-card-header">
          <div className="builder-module-add-icon">
            <PlusOutlined />
          </div>

          <div>
            <h2>Thông tin chương</h2>
            <p>
              Nhập tên rõ ràng, mô tả nội dung chính của chương.
            </p>
          </div>
        </div>

        <div className="builder-module-add-form">
          <label htmlFor="module-title">Tên chương</label>

          <Input
            id="module-title"
            size="large"
            maxLength={200}
            showCount
            autoFocus
            placeholder="Ví dụ: Kiến thức giao tiếp cơ bản"
            value={title}
            disabled={saving || cannotEdit}
            onChange={(event) => setTitle(event.target.value)}
            onPressEnter={() => {
              if (!saving && !cannotEdit) {
                void handleSave();
              }
            }}
          />

          <p className="builder-module-add-help">
            Chương mới sẽ được thêm vào cuối cấu trúc khóa học.
          </p>
        </div>

        <div className="builder-module-add-actions">
          <InstructorButton onClick={() => navigate(base)} disabled={saving}>
            Hủy
          </InstructorButton>

          <InstructorButton
            type="primary"
            onClick={() => void handleSave()}
            disabled={saving || cannotEdit || !title.trim()}
          >
            {saving ? "Saving..." : "Add Module"}
          </InstructorButton>
        </div>
      </div>
    </div>
  );
};

export default CourseBuilderModuleAdd;
