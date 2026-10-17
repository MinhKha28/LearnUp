import {
  DeleteOutlined,
  PictureOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import axios from "axios";
import {
  Alert,
  Form,
  Input,
  InputNumber,
  message,
  Skeleton,
  Upload,
} from "antd";
import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";

import {
  fetchCourseDetailAPI,
  updateCourseAPI,
  uploadCourseCoverAPI,
} from "@/services/course.service";

import type {
  CourseType,
  ICourseDetail,
  IUpdateCourseRequest,
} from "@/types/course.types";

import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/instructor/instructor.ui";

import "./course.create.scss";

interface IEditCourseForm {
  name: string;
  courseType: CourseType;
  expectedCompletionDays: number;
  shortDescription?: string;
  trainingObjectives?: string;
  learningOutcomes?: string[];
}

const CourseEdit = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const [form] = Form.useForm<IEditCourseForm>();

  const [course, setCourse] = useState<ICourseDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const [removeCover, setRemoveCover] = useState(false);

  // Thông tin hiển thị tại Course Summary.
  const watchedName = Form.useWatch("name", form);
  const watchedCourseType = Form.useWatch("courseType", form);
  const watchedDays = Form.useWatch("expectedCompletionDays", form);

  const summaryName = watchedName?.trim() || course?.name || "Untitled Course";
  const summaryType = watchedCourseType ?? course?.courseType ?? "Public";
  const summaryDays = watchedDays ?? course?.expectedCompletionDays ?? 0;

  const canEdit = course?.status === "Draft" || course?.status === "Rejected";

  // Hiển thị ảnh mới hoặc ảnh đã lưu.
  const displayedCover =
    coverPreview || (!removeCover ? course?.coverUrl : null);

  // Giải phóng URL preview khi đổi ảnh hoặc rời trang.
  useEffect(() => {
    return () => {
      if (coverPreview) {
        URL.revokeObjectURL(coverPreview);
      }
    };
  }, [coverPreview]);

  // 1. Load dữ liệu Course hiện tại.
  useEffect(() => {
    let cancelled = false;

    const loadCourse = async () => {
      if (!courseId) {
        setErrorMessage("Course ID is missing.");
        setLoading(false);
        return;
      }

      setLoading(true);
      setErrorMessage("");
      setCourse(null);
      setCoverFile(null);
      setCoverPreview("");
      setRemoveCover(false);

      try {
        const response = await fetchCourseDetailAPI(courseId);

        if (!response.data) {
          throw new Error(response.message || "Unable to load Course.");
        }

        if (cancelled) return;

        const data = response.data;

        setCourse(data);

        form.setFieldsValue({
          name: data.name,
          courseType: data.courseType,
          expectedCompletionDays: data.expectedCompletionDays,
          shortDescription: data.shortDescription ?? "",
          trainingObjectives: data.trainingObjectives ?? "",
          learningOutcomes:
            data.learningOutcomes.length > 0 ? data.learningOutcomes : [""],
        });
      } catch (error) {
        if (cancelled) return;

        console.error("Load Course error:", error);
        setErrorMessage("Unable to load Course information.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void loadCourse();

    return () => {
      cancelled = true;
    };
  }, [courseId, form]);

  // 2. Chọn ảnh mới và hiển thị preview.
  const handleCoverChange = (file: File) => {
    const allowedTypes = ["image/jpeg", "image/png", "image/webp"];

    if (!allowedTypes.includes(file.type)) {
      message.error("Only JPEG, PNG or WebP images are allowed.");
      return Upload.LIST_IGNORE;
    }

    if (file.size > 5 * 1024 * 1024) {
      message.error("Course cover must not exceed 5 MB.");
      return Upload.LIST_IGNORE;
    }

    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    setRemoveCover(false);

    return false;
  };

  // 3. Xóa ảnh đang hiển thị.
  const handleRemoveCover = () => {
    setCoverFile(null);
    setCoverPreview("");
    setRemoveCover(Boolean(course?.coverFileId));
  };

  // 4. Hủy thao tác xóa ảnh cũ.
  const handleUndoRemove = () => {
    setRemoveCover(false);
  };

  const handleCancel = () => {
    navigate(`/instructor/courses/${courseId}`);
  };

  // 5. Lưu thông tin Course qua PUT.
  const handleSave = async () => {
    if (!courseId || !course || !canEdit || saving) return;

    try {
      const values = await form.validateFields();
      setSaving(true);

      let coverFileId: string | null = removeCover ? null : course.coverFileId;

      // Chỉ upload nếu Instructor chọn ảnh mới.
      if (coverFile) {
        const uploadResponse = await uploadCourseCoverAPI(coverFile);

        if (!uploadResponse.data) {
          throw new Error(
            uploadResponse.message || "Unable to upload Course cover.",
          );
        }

        coverFileId = uploadResponse.data.fileId;
      }

      // PUT gửi đầy đủ 7 trường có thể chỉnh sửa.
      const payload: IUpdateCourseRequest = {
        name: values.name.trim(),
        courseType: values.courseType,
        expectedCompletionDays: values.expectedCompletionDays,
        shortDescription: values.shortDescription?.trim() || null,
        trainingObjectives: values.trainingObjectives?.trim() || null,
        learningOutcomes:
          values.learningOutcomes
            ?.map((item) => item?.trim())
            .filter((item): item is string => Boolean(item)) ?? [],
        coverFileId,
      };

      const response = await updateCourseAPI(courseId, payload);

      if (!response.data) {
        throw new Error(response.message || "Unable to update Course.");
      }

      message.success("Course updated successfully.");
      navigate(`/instructor/courses/${courseId}`);
    } catch (error) {
      // Lỗi validation của Ant Design.
      if (error && typeof error === "object" && "errorFields" in error) {
        return;
      }

      console.error("Update Course error:", error);

      let errorText = "Unable to update Course.";

      if (axios.isAxiosError(error)) {
        const body = error.response?.data as
          | { error?: { message?: string }; message?: string }
          | undefined;

        errorText = body?.error?.message ?? body?.message ?? errorText;
      } else if (error instanceof Error) {
        errorText = error.message;
      }

      message.error(errorText);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <InstructorPage className="course-create-page">
        <Skeleton active />
      </InstructorPage>
    );
  }

  if (!course) {
    return (
      <InstructorPage className="course-create-page">
        <PageHeader
          eyebrow="MY COURSES / EDIT"
          title="Course not found"
          subtitle="Unable to load Course information."
          back
        />

        <Alert
          type="error"
          showIcon
          message={errorMessage || "Course not found."}
        />

        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Back to My Courses
        </InstructorButton>
      </InstructorPage>
    );
  }

  // Không cho chỉnh sửa khi Status khác Draft hoặc Rejected.
  if (!canEdit) {
    return (
      <InstructorPage className="course-create-page">
        <PageHeader
          eyebrow="MY COURSES / EDIT"
          title="Course cannot be edited"
          subtitle={`Current status: ${course.status}`}
          back
        />

        <Alert
          showIcon
          type="warning"
          message="Only Draft or Rejected Course can be edited."
        />

        <InstructorButton
          onClick={() => navigate(`/instructor/courses/${course.id}`)}
        >
          Back to Course Detail
        </InstructorButton>
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="course-create-page">
      <PageHeader
        eyebrow="MY COURSES / EDIT"
        title="Edit Course"
        subtitle="Update the information of your Course."
        back
        actions={
          <InstructorButton onClick={handleCancel} disabled={saving}>
            Cancel
          </InstructorButton>
        }
      />

      <div className="course-create-layout">
        <div className="course-create-main">
          <Form form={form} layout="vertical" requiredMark="optional">
            {/* COURSE BASICS */}
            <SectionCard title="Course basics" className="course-create-card">
              <p className="course-create-section-description">
                Update the basic information of this Course.
              </p>

              <Form.Item
                label={
                  <>
                    Course name
                    <span className="course-create-required">*</span>
                  </>
                }
                name="name"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "Enter a Course name.",
                  },
                  {
                    max: 200,
                    message: "Maximum 200 characters.",
                  },
                ]}
              >
                <Input
                  size="large"
                  maxLength={200}
                  placeholder="e.g. Workplace Safety Essentials"
                />
              </Form.Item>

              <Form.Item
                label={
                  <>
                    Course type
                    <span className="course-create-required">*</span>
                  </>
                }
                name="courseType"
                rules={[{ required: true }]}
              >
                <div className="course-type-options">
                  {(["Public", "Private"] as const).map((type) => (
                    <button
                      key={type}
                      type="button"
                      aria-pressed={watchedCourseType === type}
                      className={`course-type-option ${
                        watchedCourseType === type
                          ? "course-type-option-active"
                          : ""
                      }`}
                      onClick={() => form.setFieldValue("courseType", type)}
                    >
                      <span className="course-type-radio">
                        <span />
                      </span>

                      <span>
                        <strong>{type}</strong>
                        <small>
                          {type === "Public"
                            ? "Published Course can appear in the Learner Catalog."
                            : "Hidden from the self-learning catalog."}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </Form.Item>

              <Form.Item
                label={
                  <>
                    Planned completion days
                    <span className="course-create-required">*</span>
                  </>
                }
                name="expectedCompletionDays"
                rules={[
                  {
                    required: true,
                    message: "Enter planned completion days.",
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  precision={0}
                  size="large"
                  placeholder="e.g. 14"
                  addonAfter="days"
                  className="course-create-days"
                />
              </Form.Item>

              <p className="course-create-help">
                This value is used when calculating deadlines for Required
                Enrollments.
              </p>
            </SectionCard>

            {/* OPTIONAL DETAILS */}
            <SectionCard
              title="Optional details"
              className="course-create-card"
            >
              <p className="course-create-section-description">
                Update the Course description, learning outcomes and cover
                image.
              </p>

              {/* COURSE COVER */}
              <div className="course-cover-field">
                <div className="course-cover-label">
                  <strong>Course cover</strong>
                  <span>Optional. JPEG, PNG or WebP, maximum 5 MB.</span>
                </div>

                {displayedCover ? (
                  <div className="course-cover-preview">
                    <img src={displayedCover} alt="Course cover preview" />

                    <button
                      type="button"
                      className="course-cover-remove"
                      onClick={handleRemoveCover}
                      disabled={saving}
                    >
                      <DeleteOutlined />
                      Remove
                    </button>
                  </div>
                ) : (
                  <Upload.Dragger
                    accept="image/jpeg,image/png,image/webp"
                    multiple={false}
                    maxCount={1}
                    showUploadList={false}
                    beforeUpload={handleCoverChange}
                    disabled={saving}
                  >
                    <p className="ant-upload-drag-icon">
                      <PictureOutlined />
                    </p>

                    <p className="ant-upload-text">Upload Course cover</p>

                    <p className="ant-upload-hint">
                      JPEG, PNG or WebP · Max 5 MB
                    </p>
                  </Upload.Dragger>
                )}

                {removeCover && course.coverFileId && (
                  <InstructorButton
                    onClick={handleUndoRemove}
                    disabled={saving}
                    style={{ marginTop: 12 }}
                  >
                    Undo remove
                  </InstructorButton>
                )}
              </div>

              <Form.Item label="Short description" name="shortDescription">
                <Input.TextArea
                  rows={3}
                  maxLength={500}
                  showCount
                  placeholder="Briefly describe this Course"
                />
              </Form.Item>

              <Form.Item label="Training objective" name="trainingObjectives">
                <Input.TextArea
                  rows={4}
                  maxLength={2000}
                  showCount
                  placeholder="Describe the main training objective"
                />
              </Form.Item>

              {/* LEARNING OUTCOMES */}
              <Form.List name="learningOutcomes">
                {(fields, { add, remove }) => (
                  <div>
                    <div className="course-outcomes-header">
                      <div>
                        <strong>Learning Outcomes</strong>
                        <p>Optional while Draft or Rejected.</p>
                      </div>

                      <InstructorButton
                        disabled={fields.length >= 20 || saving}
                        onClick={() => add("")}
                      >
                        <PlusOutlined />
                        Add outcome
                      </InstructorButton>
                    </div>

                    {fields.map((field, index) => (
                      <div key={field.key} className="course-outcome-row">
                        <Form.Item {...field} noStyle>
                          <Input
                            maxLength={200}
                            placeholder={`Outcome ${index + 1}`}
                          />
                        </Form.Item>

                        <button
                          type="button"
                          className="course-outcome-remove"
                          aria-label="Remove learning outcome"
                          disabled={saving}
                          onClick={() => remove(field.name)}
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    ))}

                    {fields.length === 0 && (
                      <div className="course-outcomes-empty">
                        No Learning Outcomes added.
                      </div>
                    )}
                  </div>
                )}
              </Form.List>
            </SectionCard>

            {/* ACTION BUTTONS */}
            <div className="course-create-actions">
              <InstructorButton onClick={handleCancel} disabled={saving}>
                Cancel
              </InstructorButton>

              <InstructorButton
                type="primary"
                loading={saving}
                onClick={() => void handleSave()}
              >
                Save Changes
              </InstructorButton>
            </div>
          </Form>
        </div>

        {/* COURSE SUMMARY */}
        <aside className="course-create-summary">
          <SectionCard title="Course summary">
            <div className="course-summary-name">{summaryName}</div>

            <SummaryRow
              label="Status"
              value={
                <StatusTag
                  tone={course.status === "Rejected" ? "error" : "neutral"}
                >
                  {course.status}
                </StatusTag>
              }
            />

            <SummaryRow
              label="Version"
              value={`Version ${course.versionNumber}`}
            />

            <SummaryRow label="Course type" value={summaryType} />

            <SummaryRow
              label="Planned completion"
              value={summaryDays > 0 ? `${summaryDays} days` : "Not set"}
            />

            <div className="course-summary-divider" />

            <div className="course-summary-checklist">
              <span className="course-summary-title">Required to save</span>

              <RequirementItem
                completed={Boolean(watchedName?.trim())}
                label="Course name"
              />

              <RequirementItem
                completed={Boolean(watchedCourseType)}
                label="Course type"
              />

              <RequirementItem
                completed={Boolean(watchedDays && watchedDays > 0)}
                label="Planned completion days"
              />
            </div>

            <div className="course-summary-note">
              Changes will be saved to the current Course version.
            </div>
          </SectionCard>
        </aside>
      </div>
    </InstructorPage>
  );
};

// Giống component SummaryRow trong Create Course.
const SummaryRow = ({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) => (
  <div className="course-summary-row">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

// Giống component RequirementItem trong Create Course.
const RequirementItem = ({
  completed,
  label,
}: {
  completed: boolean;
  label: string;
}) => (
  <div
    className={`course-requirement ${
      completed ? "course-requirement-completed" : ""
    }`}
  >
    <span className="course-requirement-icon">{completed ? "✓" : "•"}</span>
    <span>{label}</span>
  </div>
);

export default CourseEdit;
