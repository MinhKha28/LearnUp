import { ArrowDownOutlined, ArrowUpOutlined } from "@ant-design/icons";
import { Alert, Input, message } from "antd";
import axios from "axios";
import { useEffect, useState } from "react";
import { useNavigate, useOutletContext, useParams } from "react-router-dom";

import type { ICourseBuilderOutletContext } from "@/components/layout/layout.instructor.course";
import { InstructorButton } from "@/components/instructor/instructor.ui";
import { updateCourseStructureAPI } from "@/services/course.service";

import type {
  IUpdateCourseStructureRequest,
  IUpdateStructureModule,
} from "@/types/course.types";

import "./course.builder.scss";

const CourseBuilderStructureEdit = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();

  const { structure, refetchStructure } =
    useOutletContext<ICourseBuilderOutletContext>();

  const course = structure.course;
  const base = `/instructor/courses/${course.id}/builder`;

  // Dữ liệu đang chỉnh sửa, chưa ghi database.
  const [modules, setModules] = useState<IUpdateStructureModule[]>([]);
  const [saving, setSaving] = useState(false);

  const submitted = course.status === "Submitted";
  const reorderDisabled = course.locked || submitted;

  // 1. Copy cây hiện tại sang state chỉnh sửa.
  useEffect(() => {
    setModules(
      structure.modules.map((module) => ({
        id: module.id,
        title: module.title,
        lessons: module.lessons.map((lesson) => ({
          id: lesson.id,
          title: lesson.title,
        })),
      })),
    );
  }, [structure]);

  // 2. Sửa tiêu đề Module.
  const changeModuleTitle = (moduleId: string, title: string) => {
    setModules((current) =>
      current.map((module) =>
        module.id === moduleId ? { ...module, title } : module,
      ),
    );
  };

  // 3. Sửa tiêu đề Lesson.
  const changeLessonTitle = (
    moduleId: string,
    lessonId: string,
    title: string,
  ) => {
    setModules((current) =>
      current.map((module) => {
        if (module.id !== moduleId) return module;

        return {
          ...module,
          lessons: module.lessons.map((lesson) =>
            lesson.id === lessonId ? { ...lesson, title } : lesson,
          ),
        };
      }),
    );
  };

  // 4. Đổi vị trí hai phần tử liền kề.
  const swapItems = <T,>(items: T[], index: number, direction: -1 | 1): T[] => {
    const targetIndex = index + direction;

    if (targetIndex < 0 || targetIndex >= items.length) {
      return items;
    }

    const result = [...items];

    [result[index], result[targetIndex]] = [result[targetIndex], result[index]];

    return result;
  };

  // 5. Đổi thứ tự Module.
  const moveModule = (index: number, direction: -1 | 1) => {
    if (reorderDisabled || saving) return;

    setModules((current) => swapItems(current, index, direction));
  };

  // 6. Đổi thứ tự Lesson trong cùng Module.
  const moveLesson = (moduleId: string, index: number, direction: -1 | 1) => {
    if (reorderDisabled || saving) return;

    setModules((current) =>
      current.map((module) => {
        if (module.id !== moduleId) return module;

        return {
          ...module,
          lessons: swapItems(module.lessons, index, direction),
        };
      }),
    );
  };

  // 7. Lưu toàn bộ cây bằng PUT.
  const handleSave = async () => {
    if (!courseId || submitted || saving) return;

    const normalizedModules = modules.map((module) => ({
      id: module.id,
      title: module.title.trim(),
      lessons: module.lessons.map((lesson) => ({
        id: lesson.id,
        title: lesson.title.trim(),
      })),
    }));

    // Kiểm tra tiêu đề trước khi gọi API.
    for (const module of normalizedModules) {
      if (!module.title) {
        message.warning("Module title cannot be empty.");
        return;
      }

      if (module.title.length > 200) {
        message.warning("Module title cannot exceed 200 characters.");
        return;
      }

      for (const lesson of module.lessons) {
        if (!lesson.title) {
          message.warning("Lesson title cannot be empty.");
          return;
        }

        if (lesson.title.length > 200) {
          message.warning("Lesson title cannot exceed 200 characters.");
          return;
        }
      }
    }

    const payload: IUpdateCourseStructureRequest = {
      modules: normalizedModules,
    };

    setSaving(true);

    try {
      const response = await updateCourseStructureAPI(courseId, payload);

      if (!response.data?.updated) {
        throw new Error("Unable to save Course structure.");
      }

      // Đồng bộ lại dữ liệu cây thật sau khi lưu.
      await refetchStructure();

      message.success("Course structure updated successfully.");

      navigate(base);
    } catch (error) {
      console.error("Update structure error:", error);

      let errorText = "Unable to update Course structure.";

      if (axios.isAxiosError(error)) {
        const body = error.response?.data as
          | {
              error?: { message?: string | string[] };
              message?: string | string[];
            }
          | undefined;

        const detail = body?.error?.message ?? body?.message;

        if (typeof detail === "string") {
          errorText = detail;
        } else if (Array.isArray(detail) && detail.length > 0) {
          errorText = detail[0];
        }
      } else if (error instanceof Error) {
        errorText = error.message;
      }

      message.error(errorText);
    } finally {
      setSaving(false);
    }
  };

  // Submitted vẫn bị khóa theo quy trình phê duyệt.
  if (submitted) {
    return (
      <div className="builder-structure-edit-page">
        <h1>Edit Course Structure</h1>

        <Alert
          showIcon
          type="warning"
          message="Course is awaiting approval."
          description="Withdraw the Course before editing its structure."
        />

        <div className="builder-structure-edit-actions">
          <InstructorButton onClick={() => navigate(base)}>
            Back to Course Structure
          </InstructorButton>
        </div>
      </div>
    );
  }

  return (
    <div className="builder-structure-edit-page">
      <div className="builder-structure-edit-header">
        <div>
          <span className="builder-editor-eyebrow">COURSE BUILDER</span>
          <h1>Edit Course Structure</h1>
          <p>Rename Modules and Lessons, or adjust their order.</p>
        </div>
      </div>

      {course.locked ? (
        <Alert
          type="warning"
          showIcon
          message="Course structure is Locked"
          description="You can edit Module and Lesson titles. Reordering is disabled."
          className="builder-structure-edit-alert"
        />
      ) : (
        <Alert
          type="info"
          showIcon
          message="Course structure is Unlocked"
          description="Use the arrow buttons to reorder Modules and Lessons."
          className="builder-structure-edit-alert"
        />
      )}

      {modules.length === 0 && (
        <div className="builder-structure-edit-empty">
          This Course has no Modules yet.
        </div>
      )}

      {/* Danh sách Module */}
      <div className="builder-structure-edit-list">
        {modules.map((module, moduleIndex) => (
          <div key={module.id} className="builder-structure-edit-module">
            {/* Module header */}
            <div className="builder-structure-edit-module-header">
              <div className="builder-structure-edit-title">
                <span className="builder-module-number">{moduleIndex + 1}</span>

                <div className="builder-structure-edit-field">
                  <label htmlFor={`module-${module.id}`}>Module title</label>

                  <Input
                    id={`module-${module.id}`}
                    value={module.title}
                    maxLength={200}
                    disabled={saving}
                    onChange={(event) =>
                      changeModuleTitle(module.id, event.target.value)
                    }
                  />
                </div>
              </div>

              <div className="builder-structure-edit-controls">
                <InstructorButton
                  aria-label={`Move Module ${moduleIndex + 1} up`}
                  disabled={saving || reorderDisabled || moduleIndex === 0}
                  onClick={() => moveModule(moduleIndex, -1)}
                >
                  <ArrowUpOutlined />
                </InstructorButton>

                <InstructorButton
                  aria-label={`Move Module ${moduleIndex + 1} down`}
                  disabled={
                    saving ||
                    reorderDisabled ||
                    moduleIndex === modules.length - 1
                  }
                  onClick={() => moveModule(moduleIndex, 1)}
                >
                  <ArrowDownOutlined />
                </InstructorButton>
              </div>
            </div>

            {/* Lesson thuộc Module */}
            <div className="builder-structure-edit-lessons">
              {module.lessons.map((lesson, lessonIndex) => (
                <div key={lesson.id} className="builder-structure-edit-lesson">
                  <span className="builder-structure-edit-index">
                    {moduleIndex + 1}.{lessonIndex + 1}
                  </span>

                  <div className="builder-structure-edit-field">
                    <label htmlFor={`lesson-${lesson.id}`}>Lesson title</label>

                    <Input
                      id={`lesson-${lesson.id}`}
                      value={lesson.title}
                      maxLength={200}
                      disabled={saving}
                      onChange={(event) =>
                        changeLessonTitle(
                          module.id,
                          lesson.id,
                          event.target.value,
                        )
                      }
                    />
                  </div>

                  <div className="builder-structure-edit-controls">
                    <InstructorButton
                      aria-label={`Move Lesson ${lessonIndex + 1} up`}
                      disabled={saving || reorderDisabled || lessonIndex === 0}
                      onClick={() => moveLesson(module.id, lessonIndex, -1)}
                    >
                      <ArrowUpOutlined />
                    </InstructorButton>

                    <InstructorButton
                      aria-label={`Move Lesson ${lessonIndex + 1} down`}
                      disabled={
                        saving ||
                        reorderDisabled ||
                        lessonIndex === module.lessons.length - 1
                      }
                      onClick={() => moveLesson(module.id, lessonIndex, 1)}
                    >
                      <ArrowDownOutlined />
                    </InstructorButton>
                  </div>
                </div>
              ))}

              {module.lessons.length === 0 && (
                <p className="builder-structure-edit-empty-lessons">
                  This Module has no Lessons.
                </p>
              )}
            </div>
          </div>
        ))}
      </div>

      <div className="builder-structure-edit-actions">
        <InstructorButton disabled={saving} onClick={() => navigate(base)}>
          Cancel
        </InstructorButton>

        <InstructorButton
          type="primary"
          loading={saving}
          onClick={() => void handleSave()}
        >
          Save Structure
        </InstructorButton>
      </div>
    </div>
  );
};

export default CourseBuilderStructureEdit;
