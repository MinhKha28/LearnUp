import { Form, Input, Upload } from "antd";
import { UploadOutlined } from "@ant-design/icons";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  WarningPanel,
} from "@/components/organizer/organizer.ui";
import "./organization.edit.scss";

const OrganizationEdit = () => {
  const navigate = useNavigate();
  return (
    <OrganizerPage className="organizer-organization-edit">
      <PageHeader
        title="Edit Organization"
        subtitle="Update legal identity, contact, and timezone."
        actions={
          <>
            <OrganizerButton onClick={() => navigate(-1)}>Cancel</OrganizerButton>
            <OrganizerButton
              type="primary"
              htmlType="submit"
              form="organization-edit-form"
            >
              Save changes
            </OrganizerButton>
          </>
        }
      />
      <SectionCard title="Organization settings">
        <Form
          id="organization-edit-form"
          className="organizer-form"
          layout="vertical"
          initialValues={{
            name: "Northstar Learning Co., Ltd.",
            taxCode: "1801234567",
            address: "Can Tho City, Viet Nam",
            contact: "training@northstar.example",
            timezone: "Asia/Ho_Chi_Minh",
          }}
          onFinish={() => navigate("/organizer/organization")}
        >
          <div className="organizer-form-grid">
            <Form.Item label="Organization name" name="name" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Tax code" name="taxCode" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Address" name="address" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Contact information" name="contact" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Timezone" name="timezone" rules={[{ required: true }]}>
              <Input />
            </Form.Item>
            <Form.Item label="Organization logo">
              <Upload maxCount={1} beforeUpload={() => false}>
                <OrganizerButton icon={<UploadOutlined />}>
                  Upload logo
                </OrganizerButton>
              </Upload>
            </Form.Item>
          </div>
        </Form>
      </SectionCard>
      <WarningPanel title="Changing timezone impacts future deadlines">
        Already-computed deadlines are not silently recalculated.
      </WarningPanel>
    </OrganizerPage>
  );
};

export default OrganizationEdit;
