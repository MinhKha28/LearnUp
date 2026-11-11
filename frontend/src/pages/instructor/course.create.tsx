import {
  DeleteOutlined,
  PictureOutlined,
  PlusOutlined,
} from "@ant-design/icons";
import { Form, Input, InputNumber, message, Upload } from "antd";
import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  createCourseAPI,
  uploadCourseCoverAPI,
} from "@/services/course.service";
import type { CourseType, ICreateCourseRequest } from "@/types/course.types";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatusTag,
} from "@/components/instructor/instructor.ui";
import "./course.create.scss";

interface ICreateCourseForm {
  name: string;
  courseType: CourseType;
  expectedCompletionDays: number;

  shortDescription?: string;
  trainingObjectives?: string;
  learningOutcomes?: string[];
}

const CourseCreate = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm<ICreateCourseForm>();
  const [creating, setCreating] = useState(false);
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverPreview, setCoverPreview] = useState("");
  const watchedName = Form.useWatch("name", form);
  const watchedCourseType = Form.useWatch("courseType", form);
  const watchedDays = Form.useWatch("expectedCompletionDays", form);
  const summaryName = watchedName?.trim() || "Untitled Course";
  const summaryType = watchedCourseType ?? "Public";
  const summaryDays = watchedDays ?? 0;
  const canCreate = useMemo(
    () =>
      Boolean(
        watchedName?.trim() &&
        watchedCourseType &&
        watchedDays &&
        watchedDays > 0,
      ),
    [watchedName, watchedCourseType, watchedDays],
  );

  useEffect(() => {
    return () => {
      if (coverPreview) URL.revokeObjectURL(coverPreview);
    };
  }, [coverPreview]);
  const handleCoverChange = (file: File) => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(file);
    setCoverPreview(URL.createObjectURL(file));
    return false;
  };

  const handleRemoveCover = () => {
    if (coverPreview) URL.revokeObjectURL(coverPreview);
    setCoverFile(null);
    setCoverPreview("");
  };

  const handleCancel = () => {
    navigate("/instructor/courses");
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
      setCreating(true);
      let coverFileId: string | undefined;
      if (coverFile) {
        const uploadResponse = await uploadCourseCoverAPI(coverFile);

        if (!uploadResponse.data) {
          message.error(
            uploadResponse.message || "Unable to upload Course cover.",
          );
          return;
        }
        coverFileId = uploadResponse.data.fileId;
      }

      const payload: ICreateCourseRequest = {
        name: values.name.trim(),
        courseType: values.courseType,
        expectedCompletionDays: values.expectedCompletionDays,
        shortDescription: values.shortDescription?.trim() || undefined,
        trainingObjectives: values.trainingObjectives?.trim() || undefined,
        learningOutcomes:
          values.learningOutcomes
            ?.map((item) => item?.trim())
            .filter((item): item is string => Boolean(item)) ?? [],
        coverFileId,
      };

      const response = await createCourseAPI(payload);

      if (!response.data) {
        message.error(response.message || "Unable to create Course.");
        return;
      }

      message.success("Draft Course created.");
      navigate(`/instructor/courses/${response.data.id}/builder`);
    } catch (error) {
      console.error("Create Course error:", error);
      message.error("Unable to create Course.");
    } finally {
      setCreating(false);
    }
  };

  return (
    <InstructorPage className="course-create-page">
      <PageHeader
        eyebrow="Khóa học của tôi / Tạo mới"
        title="Tạo khóa học"
        subtitle="Tạo khóa học bản nháp rồi tiếp tục xây dựng nội dung học tập."
        back
        actions={
          <InstructorButton onClick={handleCancel}>Hủy</InstructorButton>
        }
      />

      <div className="course-create-layout">
        <div className="course-create-main">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              courseType: "Public",
              learningOutcomes: [""],
            }}
            requiredMark="optional"
          >
            <SectionCard title="Thông tin cơ bản" className="course-create-card">
              <p className="course-create-section-description">
                Điền các thông tin bắt buộc để tạo khóa học bản nháp.
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
                    message: "Tên khóa học không được vượt quá 200 ký tự.",
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
                rules={[
                  {
                    required: true,
                  },
                ]}
              >
                <div className="course-type-options">
                  <CourseTypeOption
                    value="Public"
                    title="Công khai"
                    description="Khóa học đã phát hành có thể xuất hiện trong danh mục tự học."
                    form={form}
                  />

                  <CourseTypeOption
                    value="Private"
                    title="Nội bộ"
                    description="Không hiển thị trong danh mục tự học."
                    form={form}
                  />
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
                This value is used later when calculating deadlines for Required
                Enrollments.
              </p>
            </SectionCard>

            <SectionCard
              title="Thông tin bổ sung"
              className="course-create-card"
            >
              <p className="course-create-section-description">
                These fields can be completed now or while the Course remains
                Draft.
              </p>
              <div className="course-cover-field">
                <div className="course-cover-label">
                  <strong>Ảnh bìa khóa học</strong>
                  <span>Không bắt buộc. Hỗ trợ JPEG, PNG hoặc WebP, tối đa 5 MB.</span>
                </div>

                {coverPreview ? (
                  <div className="course-cover-preview">
                    <img src={coverPreview} alt="Course cover preview" />

                    <button
                      type="button"
                      className="course-cover-remove"
                      onClick={handleRemoveCover}
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

              <Form.List name="learningOutcomes">
                {(fields, { add, remove }) => (
                  <div>
                    <div className="course-outcomes-header">
                      <div>
                        <strong>Kết quả học tập mong đợi</strong>

                        <p>Không bắt buộc khi còn là bản nháp.</p>
                      </div>

                      <InstructorButton onClick={() => add("")}>
                        <PlusOutlined />
                        Thêm kết quả học tập
                      </InstructorButton>
                    </div>

                    {fields.map((field, index) => (
                      <div className="course-outcome-row" key={field.key}>
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

            <div className="course-create-actions">
              <InstructorButton onClick={handleCancel} disabled={creating}>
                Hủy
              </InstructorButton>

              <InstructorButton
                type="primary"
                onClick={() => void handleCreate()}
                disabled={creating || !canCreate}
              >
                {creating ? "Creating..." : "Create Draft"}
              </InstructorButton>
            </div>
          </Form>
        </div>

        <aside className="course-create-summary">
          <SectionCard title="Tóm tắt bản nháp">
            <div className="course-summary-name">{summaryName}</div>

            <SummaryRow
              label="Trạng thái"
              value={<StatusTag tone="neutral">Bản nháp</StatusTag>}
            />

            <SummaryRow label="Phiên bản" value="Version 1" />

            <SummaryRow
              label="Loại khóa học"
              value={summaryType === "Public" ? "Public" : "Private"}
            />

            <SummaryRow
              label="Thời gian hoàn thành dự kiến"
              value={summaryDays > 0 ? `${summaryDays} days` : "Not set"}
            />

            <div className="course-summary-divider" />

            <div className="course-summary-checklist">
              <span className="course-summary-title">Thông tin bắt buộc khi tạo</span>

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
              After creating the Draft, you will continue in the Course Builder
              to add Modules, Lessons and learning content.
            </div>
          </SectionCard>
        </aside>
      </div>
    </InstructorPage>
  );
};

interface ICourseTypeOptionProps {
  value: CourseType;
  title: string;
  description: string;
  form: ReturnType<typeof Form.useForm<ICreateCourseForm>>[0];
}

const CourseTypeOption = ({
  value,
  title,
  description,
  form,
}: ICourseTypeOptionProps) => {
  const current = Form.useWatch("courseType", form);

  const active = current === value;

  return (
    <button
      type="button"
      className={`course-type-option ${
        active ? "course-type-option-active" : ""
      }`}
      onClick={() => form.setFieldValue("courseType", value)}
    >
      <span className="course-type-radio">
        <span />
      </span>

      <span>
        <strong>{title}</strong>

        <small>{description}</small>
      </span>
    </button>
  );
};

interface ISummaryRowProps {
  label: string;
  value: string | React.ReactNode;
}

const SummaryRow = ({ label, value }: ISummaryRowProps) => (
  <div className="course-summary-row">
    <span>{label}</span>
    <strong>{value}</strong>
  </div>
);

interface IRequirementItemProps {
  completed: boolean;
  label: string;
}

const RequirementItem = ({ completed, label }: IRequirementItemProps) => (
  <div
    className={`course-requirement ${
      completed ? "course-requirement-completed" : ""
    }`}
  >
    <span className="course-requirement-icon">{completed ? "✓" : "•"}</span>
    <span>{label}</span>
  </div>
);

export default CourseCreate;
