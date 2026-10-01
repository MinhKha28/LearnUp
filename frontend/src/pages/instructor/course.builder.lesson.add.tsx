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
  const module = structure.modules.find((item) => item.id === moduleId);

  if (!module) {
    return (
      <div className="builder-create-page">
        <div className="builder-create-card">
          <p>Module not found.</p>

          <div className="builder-create-actions">
            <InstructorButton onClick={() => navigate(base)}>
              Back to Course Structure
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
      message.warning("Enter a Lesson title.");
      return;
    }

    if (!normalizedContent) {
      message.warning("Enter Lesson content.");
      return;
    }

    if (structure.structureLocked) {
      message.error(structure.lockReason || "Course structure is locked.");
      return;
    }

    try {
      setSaving(true);

      const response = await createCourseLessonAPI(courseId, moduleId, {
        title: normalizedTitle,
        content: normalizedContent,
      });

      if (!response.data) {
        message.error(response.message || "Unable to create Lesson.");
        return;
      }

      message.success("Lesson created.");

      await refetchStructure();

      navigate(base, {
        replace: true,
      });
    } catch (error) {
      console.error("Create Lesson error:", error);
      message.error("Unable to create Lesson.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="builder-create-page">
      <div className="builder-create-header">
        <span className="builder-editor-eyebrow">COURSE STRUCTURE</span>
        <h1>Add Lesson</h1>

        <p>
          Add a new Lesson to <strong>{module.title}</strong>.
        </p>
      </div>

      <div className="builder-create-card">
        <div className="builder-create-card-header">
          <div className="builder-create-icon">
            <BookOutlined />
          </div>

          <div>
            <h2>Lesson information</h2>
            <p>Enter the Lesson title and introductory content.</p>
          </div>
        </div>

        <div className="builder-create-form">
          <label htmlFor="lesson-title">Lesson title</label>

          <Input
            id="lesson-title"
            size="large"
            maxLength={200}
            showCount
            autoFocus
            placeholder="e.g. Introduction to Spring Boot"
            value={title}
            disabled={saving || structure.structureLocked}
            onChange={(event) => setTitle(event.target.value)}
          />

          <label
            htmlFor="lesson-content"
            className="builder-create-label-spaced"
          >
            Lesson content
          </label>

          <Input.TextArea
            id="lesson-content"
            rows={7}
            maxLength={20000}
            showCount
            placeholder="Write the Lesson introduction..."
            value={content}
            disabled={saving || structure.structureLocked}
            onChange={(event) => setContent(event.target.value)}
          />

          <p className="builder-create-help">
            The new Lesson will be placed at the end of this Module.
          </p>
        </div>

        <div className="builder-create-actions">
          <InstructorButton onClick={() => navigate(base)} disabled={saving}>
            Cancel
          </InstructorButton>

          <InstructorButton
            type="primary"
            onClick={() => void handleSave()}
            disabled={
              saving ||
              structure.structureLocked ||
              !title.trim() ||
              !content.trim()
            }
          >
            {saving ? "Saving..." : "Add Lesson"}
          </InstructorButton>
        </div>
      </div>
    </div>
  );
};

export default CourseBuilderLessonAdd;
