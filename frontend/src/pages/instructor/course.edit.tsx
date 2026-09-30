import { Form, Input, InputNumber, Select, message } from "antd";
import { useNavigate, useParams } from "react-router-dom";
import { findInstructorCourse } from "@/components/instructor/instructor.data";
import {
  InfoPanel,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
} from "@/components/instructor/instructor.ui";
import "./course.edit.scss";

interface IEditForm {
  title: string;
  shortDescription: string;
  trainingObjective: string;
  plannedCompletionDays?: number;
  visibility: "Public" | "Private";
}

const CourseEdit = () => {
  const { courseId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const [form] = Form.useForm<IEditForm>();

  if (!course) {
    return (
      <InstructorPage className="instructor-course-edit">
        <PageHeader
          eyebrow="COURSE / EDIT DETAILS"
          title="Course not found"
          subtitle="This Course may have been removed."
          back
        />
        <InstructorButton onClick={() => navigate("/instructor/courses")}>
          Back to My Courses
        </InstructorButton>
      </InstructorPage>
    );
  }

  const handleSave = async () => {
    const values = await form.validateFields();
    course.title = values.title;
    course.shortDescription = values.shortDescription;
    course.trainingObjective = values.trainingObjective;
    course.plannedCompletionDays = values.plannedCompletionDays ?? null;
    course.visibility = values.visibility;
    message.success("Course details saved.");
    navigate(`/instructor/courses/${course.id}`);
  };

  return (
    <InstructorPage className="instructor-course-edit">
      <PageHeader
        eyebrow="COURSE / EDIT DETAILS"
        title="Edit Course Details"
        subtitle="Descriptive Course fields remain editable after Locked."
        back
      />
      <div className="instructor-course-edit-grid">
        <SectionCard className="instructor-course-edit-main">
          <Form
            form={form}
            layout="vertical"
            className="instructor-form"
            initialValues={{
              title: course.title,
              shortDescription: course.shortDescription,
              trainingObjective: course.trainingObjective,
              plannedCompletionDays: course.plannedCompletionDays ?? undefined,
              visibility: course.visibility,
            }}
          >
            <Form.Item
              label="Course name"
              name="title"
              rules={[{ required: true, message: "Enter a Course name." }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Short description"
              name="shortDescription"
              rules={[{ required: true, message: "Enter a short description." }]}
            >
              <Input />
            </Form.Item>
            <Form.Item
              label="Training objective"
              name="trainingObjective"
              rules={[{ required: true, message: "Enter a training objective." }]}
            >
              <Input />
            </Form.Item>
            <Form.Item label="Planned completion days" name="plannedCompletionDays">
              <InputNumber placeholder="[Configured days]" min={1} style={{ width: "100%" }} />
            </Form.Item>
            <Form.Item label="Course type" name="visibility">
              <Select
                options={[
                  { value: "Public", label: "Public" },
                  { value: "Private", label: "Private" },
                ]}
              />
            </Form.Item>
          </Form>
          <div className="instructor-form-actions instructor-form-actions-end">
            <InstructorButton type="primary" onClick={handleSave}>
              Save changes
            </InstructorButton>
          </div>
        </SectionCard>
        <SectionCard title="Locked Course" className="instructor-course-edit-side">
          <InfoPanel title="Allowed edits">These fields describe the Course.</InfoPanel>
          <p>Changing Public to Private does not affect Learners already enrolled as Optional.</p>
        </SectionCard>
      </div>
    </InstructorPage>
  );
};

export default CourseEdit;
