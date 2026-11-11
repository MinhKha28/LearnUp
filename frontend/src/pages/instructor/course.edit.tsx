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

  const summaryName = watchedName?.trim() || course?.name || "Khóa học chưa đặt tên";
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
        setErrorMessage("Thiếu mã khóa học.");
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
          throw new Error(response.message || "Không thể tải khóa học.");
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
        setErrorMessage("Không thể tải thông tin khóa học.");
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
      message.error("Chỉ chấp nhận ảnh JPEG, PNG hoặc WebP.");
      return Upload.LIST_IGNORE;
    }

    if (file.size > 5 * 1024 * 1024) {
      message.error("Ảnh bìa khóa học không được vượt quá 5 MB.");
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
            uploadResponse.message || "Không thể tải ảnh bìa khóa học lên.",
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
        throw new Error(response.message || "Không thể cập nhật khóa học.");
      }

      message.success("Đã cập nhật khóa học.");
      navigate(`/instructor/courses/${courseId}`);
    } catch (error) {
      // Lỗi validation của Ant Design.
      if (error && typeof error === "object" && "errorFields" in error) {
        return;
      }

      console.error("Update Course error:", error);

      let errorText = "Không thể cập nhật khóa học.";

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
          eyebrow="Khóa học của tôi / Chỉnh sửa"
          title="Không tìm thấy khóa học"
          subtitle="Không thể tải thông tin khóa học."
          back
        />

        <Alert
          type="error"
          showIcon
          message={errorMessage || "Không tìm thấy khóa học."}
        />

        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Quay lại khóa học của tôi
        </InstructorButton>
      </InstructorPage>
    );
  }

  // Không cho chỉnh sửa khi Status khác Draft hoặc Rejected.
  if (!canEdit) {
    return (
      <InstructorPage className="course-create-page">
        <PageHeader
          eyebrow="Khóa học của tôi / Chỉnh sửa"
          title="Không thể chỉnh sửa khóa học"
          subtitle={`Current status: ${course.status}`}
          back
        />

        <Alert
          showIcon
          type="warning"
          message="Chỉ có thể chỉnh sửa khóa học bản nháp hoặc bị từ chối."
        />

        <InstructorButton
          onClick={() => navigate(`/instructor/courses/${course.id}`)}
        >
          Quay lại chi tiết khóa học
        </InstructorButton>
      </InstructorPage>
    );
  }

  return (
    <InstructorPage className="course-create-page">
      <PageHeader
        eyebrow="Khóa học của tôi / Chỉnh sửa"
        title="Chỉnh sửa khóa học"
        subtitle="Cập nhật thông tin khóa học."
        back
        actions={
          <InstructorButton onClick={handleCancel} disabled={saving}>
            Hủy
          </InstructorButton>
        }
      />

      <div className="course-create-layout">
        <div className="course-create-main">
          <Form form={form} layout="vertical" requiredMark="optional">
            {/* COURSE BASICS */}
            <SectionCard title="Thông tin cơ bản" className="course-create-card">
              <p className="course-create-section-description">
                Cập nhật thông tin cơ bản của khóa học.
              </p>

              <Form.Item
                label={
                  <>
                    Tên khóa học
                    <span className="course-create-required">*</span>
                  </>
                }
                name="name"
                rules={[
                  {
                    required: true,
                    whitespace: true,
                    message: "Vui lòng nhập tên khóa học.",
                  },
                  {
                    max: 200,
                    message: "Tối đa 200 ký tự.",
                  },
                ]}
              >
                <Input
                  size="large"
                  maxLength={200}
                  placeholder="Ví dụ: Kiến thức an toàn lao động"
                />
              </Form.Item>

              <Form.Item
                label={
                  <>
                    Loại khóa học
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
                            ? "Khóa học đã phát hành có thể xuất hiện trong danh mục tự học."
                            : "Không hiển thị trong danh mục tự học."}
                        </small>
                      </span>
                    </button>
                  ))}
                </div>
              </Form.Item>

              <Form.Item
                label={
                  <>
                    Số ngày hoàn thành dự kiến
                    <span className="course-create-required">*</span>
                  </>
                }
                name="expectedCompletionDays"
                rules={[
                  {
                    required: true,
                    message: "Vui lòng nhập số ngày hoàn thành dự kiến.",
                  },
                ]}
              >
                <InputNumber
                  min={1}
                  precision={0}
                  size="large"
                  placeholder="Ví dụ: 14"
                  addonAfter="days"
                  className="course-create-days"
                />
              </Form.Item>

              <p className="course-create-help">
                Giá trị này được dùng khi tính hạn hoàn thành cho các lượt học bắt buộc
                Enrollments.
              </p>
            </SectionCard>

            {/* OPTIONAL DETAILS */}
            <SectionCard
              title="Thông tin bổ sung"
              className="course-create-card"
            >
              <p className="course-create-section-description">
                Cập nhật mô tả, kết quả học tập và ảnh bìa khóa học.
              </p>

              {/* COURSE COVER */}
              <div className="course-cover-field">
                <div className="course-cover-label">
                  <strong>Ảnh bìa khóa học</strong>
                  <span>Không bắt buộc. Hỗ trợ JPEG, PNG hoặc WebP, tối đa 5 MB.</span>
                </div>

                {displayedCover ? (
                  <div className="course-cover-preview">
                    <img src={displayedCover} alt="Xem trước ảnh bìa khóa học" />

                    <button
                      type="button"
                      className="course-cover-remove"
                      onClick={handleRemoveCover}
                      disabled={saving}
                    >
                      <DeleteOutlined />
                      Xóa
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

                    <p className="ant-upload-text">Tải ảnh bìa lên</p>

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
                    Hoàn tác xóa
                  </InstructorButton>
                )}
              </div>

              <Form.Item label="Mô tả ngắn" name="shortDescription">
                <Input.TextArea
                  rows={3}
                  maxLength={500}
                  showCount
                  placeholder="Nhập mô tả ngắn về khóa học"
                />
              </Form.Item>

              <Form.Item label="Mục tiêu đào tạo" name="trainingObjectives">
                <Input.TextArea
                  rows={4}
                  maxLength={2000}
                  showCount
                  placeholder="Nhập mục tiêu đào tạo chính"
                />
              </Form.Item>

              {/* LEARNING OUTCOMES */}
              <Form.List name="learningOutcomes">
                {(fields, { add, remove }) => (
                  <div>
                    <div className="course-outcomes-header">
                      <div>
                        <strong>Kết quả học tập mong đợi</strong>
                        <p>Không bắt buộc khi ở trạng thái bản nháp hoặc bị từ chối.</p>
                      </div>

                      <InstructorButton
                        disabled={fields.length >= 20 || saving}
                        onClick={() => add("")}
                      >
                        <PlusOutlined />
                        Thêm kết quả học tập
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
                          aria-label="Xóa kết quả học tập"
                          disabled={saving}
                          onClick={() => remove(field.name)}
                        >
                          <DeleteOutlined />
                        </button>
                      </div>
                    ))}

                    {fields.length === 0 && (
                      <div className="course-outcomes-empty">
                        Chưa thêm kết quả học tập mong đợi.
                      </div>
                    )}
                  </div>
                )}
              </Form.List>
            </SectionCard>

            {/* ACTION BUTTONS */}
            <div className="course-create-actions">
              <InstructorButton onClick={handleCancel} disabled={saving}>
                Hủy
              </InstructorButton>

              <InstructorButton
                type="primary"
                loading={saving}
                onClick={() => void handleSave()}
              >
                Lưu thay đổi
              </InstructorButton>
            </div>
          </Form>
        </div>

        {/* COURSE SUMMARY */}
        <aside className="course-create-summary">
          <SectionCard title="Tóm tắt khóa học">
            <div className="course-summary-name">{summaryName}</div>

            <SummaryRow
              label="Trạng thái"
              value={
                <StatusTag
                  tone={course.status === "Rejected" ? "error" : "neutral"}
                >
                  {course.status}
                </StatusTag>
              }
            />

            <SummaryRow
              label="Phiên bản"
              value={`Phiên bản ${course.versionNumber}`}
            />

            <SummaryRow label="Loại khóa học" value={summaryType} />

            <SummaryRow
              label="Thời gian hoàn thành dự kiến"
              value={summaryDays > 0 ? `${summaryDays} days` : "Not set"}
            />

            <div className="course-summary-divider" />

            <div className="course-summary-checklist">
              <span className="course-summary-title">Thông tin bắt buộc khi lưu</span>

              <RequirementItem
                completed={Boolean(watchedName?.trim())}
                label="Tên khóa học"
              />

              <RequirementItem
                completed={Boolean(watchedCourseType)}
                label="Loại khóa học"
              />

              <RequirementItem
                completed={Boolean(watchedDays && watchedDays > 0)}
                label="Số ngày hoàn thành dự kiến"
              />
            </div>

            <div className="course-summary-note">
              Các thay đổi sẽ được lưu vào phiên bản khóa học hiện tại.
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
