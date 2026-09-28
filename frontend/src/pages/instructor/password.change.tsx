import { Form, Input, message } from "antd";
import { useNavigate } from "react-router-dom";
import { InstructorButton, InstructorPage, PageHeader, SectionCard } from "@/components/instructor/instructor.ui";
import "./password.change.scss";

type PasswordFields = { current: string; password: string; confirm: string };

const ChangePassword = () => {
  const navigate = useNavigate();

  function submit() {
    message.success("Password updated.");
    navigate("/instructor/profile");
  }

  return (
    <InstructorPage className="instructor-change-password">
      <PageHeader
        eyebrow="ACCOUNT / PASSWORD"
        title="Change Password"
        subtitle="Confirm the current password and set a new one."
        back
      />
      <SectionCard>
        <Form<PasswordFields>
          className="instructor-password-form"
          layout="vertical"
          requiredMark={false}
          onFinish={submit}
        >
          <Form.Item
            label="Current password"
            name="current"
            rules={[{ required: true, message: "Enter your current password." }]}
          >
            <Input.Password />
          </Form.Item>
          <Form.Item
            label="New password"
            name="password"
            rules={[
              { required: true, message: "Enter a new password." },
              { min: 8, message: "Use at least 8 characters." },
            ]}
          >
            <Input.Password placeholder="Enter new password" />
          </Form.Item>
          <Form.Item
            label="Confirm new password"
            name="confirm"
            dependencies={["password"]}
            rules={[
              { required: true, message: "Confirm your new password." },
              ({ getFieldValue }) => ({
                validator(_, value) {
                  return !value || getFieldValue("password") === value
                    ? Promise.resolve()
                    : Promise.reject(new Error("Passwords do not match"));
                },
              }),
            ]}
          >
            <Input.Password placeholder="Enter confirm new password" />
          </Form.Item>
          <div className="instructor-password-actions">
            <InstructorButton type="primary" htmlType="submit">
              Update password
            </InstructorButton>
          </div>
        </Form>
      </SectionCard>
    </InstructorPage>
  );
};

export default ChangePassword;
