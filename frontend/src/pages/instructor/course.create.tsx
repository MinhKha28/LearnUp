import { DeleteOutlined, PlusOutlined } from "@ant-design/icons";
import { Form, Input, InputNumber, message } from "antd";
import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createCourseAPI } from "@/services/course.service";
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
  const watchedName = Form.useWatch("name", form);
  const watchedCourseType = Form.useWatch("courseType", form);
  const watchedDays = Form.useWatch("expectedCompletionDays", form);
  const summaryName = watchedName?.trim() || "Untitled Course";
  const summaryType = watchedCourseType ?? "PUBLIC";
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

  const handleCancel = () => {
    navigate("/instructor/courses");
  };

  const handleCreate = async () => {
    try {
      const values = await form.validateFields();
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
      };

      setCreating(true);
      const response = await createCourseAPI(payload);
      if (!response.data) {
        message.error(response.message || "Unable to create Course.");
        return;
      }

      message.success("Draft Course created.");
      navigate(`/instructor/courses/${response.data.id}/builder`);
    } catch (error) {
      console.error("Create Course error:", error);
    } finally {
      setCreating(false);
    }
  };

  return (
    <InstructorPage className="course-create-page">
      <PageHeader
        eyebrow="MY COURSES / CREATE"
        title="Create Course"
        subtitle="Create a Draft Course, then continue building its learning structure."
        back
        actions={
          <InstructorButton onClick={handleCancel}>Cancel</InstructorButton>
        }
      />

      <div className="course-create-layout">
        <div className="course-create-main">
          <Form
            form={form}
            layout="vertical"
            initialValues={{
              courseType: "PUBLIC",
              learningOutcomes: [""],
            }}
            requiredMark="optional"
          >
            <SectionCard title="Course basics" className="course-create-card">
              <p className="course-create-section-description">
                Complete the required information to create a Draft Course.
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
                    message: "Course name cannot exceed 200 characters.",
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
                rules={[
                  {
                    required: true,
                  },
                ]}
              >
                <div className="course-type-options">
                  <CourseTypeOption
                    value="PUBLIC"
                    title="Public"
                    description="Published Course can appear in the Learner Catalog."
                    form={form}
                  />

                  <CourseTypeOption
                    value="PRIVATE"
                    title="Private"
                    description="Hidden from the self-learning catalog."
                    form={form}
                  />
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
                This value is used later when calculating deadlines for Required
                Enrollments.
              </p>
            </SectionCard>

            <SectionCard
              title="Optional details"
              className="course-create-card"
            >
              <p className="course-create-section-description">
                These fields can be completed now or while the Course remains
                Draft.
              </p>

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

              <Form.List name="learningOutcomes">
                {(fields, { add, remove }) => (
                  <div>
                    <div className="course-outcomes-header">
                      <div>
                        <strong>Learning Outcomes</strong>

                        <p>Optional while Draft.</p>
                      </div>

                      <InstructorButton onClick={() => add("")}>
                        <PlusOutlined />
                        Add outcome
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
                          aria-label="Remove learning outcome"
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

            <div className="course-create-actions">
              <InstructorButton onClick={handleCancel} disabled={creating}>
                Cancel
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
          <SectionCard title="Draft summary">
            <div className="course-summary-name">{summaryName}</div>

            <SummaryRow
              label="Status"
              value={<StatusTag tone="neutral">Draft</StatusTag>}
            />

            <SummaryRow label="Version" value="Version 1" />

            <SummaryRow
              label="Course type"
              value={summaryType === "PUBLIC" ? "Public" : "Private"}
            />

            <SummaryRow
              label="Planned completion"
              value={summaryDays > 0 ? `${summaryDays} days` : "Not set"}
            />

            <div className="course-summary-divider" />

            <div className="course-summary-checklist">
              <span className="course-summary-title">Required to create</span>

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
