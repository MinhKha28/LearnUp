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

  const handleSave = async () => {
    if (saving) return;

    const normalizedTitle = title.trim();

    if (!normalizedTitle) {
      message.warning("Enter a Module title.");
      return;
    }

    if (structure.structureLocked) {
      message.error(structure.lockReason || "Course structure is locked.");
      return;
    }

    try {
      setSaving(true);

      const response = await createCourseModuleAPI(courseId, {
        title: normalizedTitle,
      });

      if (!response.data) {
        message.error(response.message || "Unable to create Module.");
        return;
      }

      message.success("Module created.");
      await refetchStructure();

      navigate(base, {
        replace: true,
      });
    } catch (error) {
      console.error("Create Module error:", error);
      message.error("Unable to create Module.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="builder-module-add-page">
      <div className="builder-module-add-header">
        <span className="builder-editor-eyebrow">COURSE STRUCTURE</span>
        <h1>Add Module</h1>
        <p>Create a new Module and add it to the end of this Course.</p>
      </div>

      <div className="builder-module-add-card">
        <div className="builder-module-add-card-header">
          <div className="builder-module-add-icon">
            <PlusOutlined />
          </div>

          <div>
            <h2>Module information</h2>
            <p>
              Enter a clear title that describes this section of the Course.
            </p>
          </div>
        </div>

        <div className="builder-module-add-form">
          <label htmlFor="module-title">Module title</label>

          <Input
            id="module-title"
            size="large"
            maxLength={200}
            showCount
            autoFocus
            placeholder="e.g. Communication Fundamentals"
            value={title}
            disabled={saving || structure.structureLocked}
            onChange={(event) => setTitle(event.target.value)}
            onPressEnter={() => {
              if (!saving && !structure.structureLocked) {
                void handleSave();
              }
            }}
          />

          <p className="builder-module-add-help">
            The new Module will be placed at the end of the Course structure.
          </p>
        </div>

        <div className="builder-module-add-actions">
          <InstructorButton onClick={() => navigate(base)} disabled={saving}>
            Cancel
          </InstructorButton>

          <InstructorButton
            type="primary"
            onClick={() => void handleSave()}
            disabled={saving || structure.structureLocked || !title.trim()}
          >
            {saving ? "Saving..." : "Add Module"}
          </InstructorButton>
        </div>
      </div>
    </div>
  );
};

export default CourseBuilderModuleAdd;
