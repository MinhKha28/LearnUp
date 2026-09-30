import { InboxOutlined } from "@ant-design/icons";
import { Form, Input, Upload, message } from "antd";
import { useEffect } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { isCourseQuotaReached } from "@/components/instructor/instructor.data";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
} from "@/components/instructor/instructor.ui";
import "./course.create.scss";

export interface IBasicDraft {
  title: string;
  shortDescription: string;
  coverImageName?: string;
  trainingObjective: string;
}

const CourseCreateBasic = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const initial = (location.state as { basic?: IBasicDraft } | null)?.basic;
  const [form] = Form.useForm<IBasicDraft>();

  useEffect(() => {
    if (isCourseQuotaReached()) {
      navigate("/instructor/courses/create/quota-blocked", { replace: true });
    }
  }, [navigate]);

  const handleContinue = async () => {
    const values = await form.validateFields();
    navigate("/instructor/courses/create/outcomes", { state: { basic: values } });
  };

  return (
    <InstructorPage className="instructor-course-create">
      <PageHeader
        eyebrow="MY COURSES / CREATE"
        title="Create Course"
        subtitle="Start a new Draft Course with basic information."
        back
      />
      <div className="instructor-course-create-grid">
        <SectionCard className="instructor-course-create-main">
          <Form
            form={form}
            layout="vertical"
            className="instructor-form"
            initialValues={
              initial ?? {
                title: "Workplace Safety Essentials",
                shortDescription: "An introduction to workplace safety practices",
                trainingObjective: "Understand essential procedures",
              }
            }
          >
            <Form.Item
              label="Course name"
              name="title"
              rules={[{ required: true, message: "Enter a Course name." }]}
            >
              <Input placeholder="Course name" />
            </Form.Item>
            <Form.Item
              label="Short description"
              name="shortDescription"
              rules={[{ required: true, message: "Enter a short description." }]}
            >
              <Input placeholder="Short description" />
            </Form.Item>
            <Form.Item label="Cover image">
              <Upload.Dragger
                className="instructor-cover-upload"
                maxCount={1}
                beforeUpload={(file) => {
                  message.success(`${file.name} selected.`);
                  return false;
                }}
                showUploadList={{ showRemoveIcon: true }}
              >
                <p className="instructor-cover-upload-icon">
                  <InboxOutlined />
                </p>
                <p className="instructor-cover-upload-text">Upload a Course cover</p>
              </Upload.Dragger>
            </Form.Item>
            <Form.Item
              label="Training objective"
              name="trainingObjective"
              rules={[{ required: true, message: "Enter a training objective." }]}
            >
              <Input placeholder="Training objective" />
            </Form.Item>
          </Form>
          <div className="instructor-form-actions instructor-form-actions-end">
            <InstructorButton type="primary" onClick={handleContinue}>
              Continue
            </InstructorButton>
          </div>
        </SectionCard>
        <SectionCard title="Draft creation" className="instructor-course-create-side">
          <p>Course quota is checked before a Draft can be created.</p>
          <p>Only Instructor authors this Course.</p>
        </SectionCard>
      </div>
    </InstructorPage>
  );
};

export default CourseCreateBasic;
