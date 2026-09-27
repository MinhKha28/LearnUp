import { CheckCircleOutlined } from "@ant-design/icons";
import { Form, Input } from "antd";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import "./password.change.scss";

const ChangePassword = () => {
  const navigate = useNavigate();
  return (
    <OrganizerPage className="organizer-change-password">
      <PageHeader
        title="Change Password"
        subtitle="Verify your current password before setting a new one."
        back
      />
      <div className="organizer-password-grid">
        <SectionCard title="Password settings">
          <Form
            className="organizer-form"
            layout="vertical"
            onFinish={() => navigate("/organizer/profile")}
          >
            <Form.Item label="Current password" name="current" rules={[{ required: true }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item label="New password" name="password" rules={[{ required: true, min: 8 }]}>
              <Input.Password />
            </Form.Item>
            <Form.Item
              label="Confirm new password"
              name="confirm"
              dependencies={["password"]}
              rules={[
                { required: true },
                ({ getFieldValue }) => ({
                  validator(_, value) {
                    return !value || getFieldValue("password") === value
                      ? Promise.resolve()
                      : Promise.reject(new Error("Passwords do not match"));
                  },
                }),
              ]}
            >
              <Input.Password />
            </Form.Item>
            <div className="organizer-form-actions">
              <OrganizerButton onClick={() => navigate(-1)}>Cancel</OrganizerButton>
              <OrganizerButton type="primary" htmlType="submit">
                Update password
              </OrganizerButton>
            </div>
          </Form>
        </SectionCard>
        <aside className="organizer-password-rules">
          <h2>Account access</h2>
          <p>
            <CheckCircleOutlined /> Organizer uses email + password
          </p>
          <p>
            <CheckCircleOutlined /> Google login does not apply to Organizer
          </p>
          <p>
            <CheckCircleOutlined /> Password recovery uses the registered email
          </p>
        </aside>
      </div>
    </OrganizerPage>
  );
};

export default ChangePassword;
