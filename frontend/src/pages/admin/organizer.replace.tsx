import { Form, Input } from "antd";
import { useNavigate } from "react-router-dom";
import { AdminButton, AdminPage, PageHeader, SectionCard, StatusTag } from "@/components/admin/admin.ui";
import "./organizer.replace.scss";

const ReplaceOrganizer = () => {
  const navigate = useNavigate();
  return (
    <AdminPage className="admin-replace-organizer">
      <PageHeader title="Thay quản lý đào tạo" subtitle="Gửi lời mời cho quản lý đào tạo mới của Northstar Learning." actions={<AdminButton onClick={() => navigate(-1)}>Về thông tin tổ chức</AdminButton>} />
      <SectionCard title="Quản lý đào tạo hiện tại">
        <div className="admin-current-organizer"><div><strong>Mai Nguyễn</strong><span>mai.nguyen@northstar.example</span></div><StatusTag tone="success">Đang hoạt động</StatusTag></div>
        <p className="admin-note">Tài khoản quản lý đào tạo hiện tại chỉ bị vô hiệu hóa sau khi người thay thế được xác lập.</p>
      </SectionCard>
      <SectionCard title="Lời mời quản lý đào tạo mới">
        <Form className="admin-form" layout="vertical" onFinish={() => navigate("/admin/organizations/northstar")}>
          <div className="admin-form-grid"><Form.Item label="Họ và tên" name="name" rules={[{ required: true }]}><Input placeholder="Trần Minh Anh" /></Form.Item><Form.Item label="Địa chỉ email" name="email" rules={[{ required: true, type: "email" }]}><Input placeholder="minh.anh@northstar.example" /></Form.Item></div>
          <div className="admin-replacement-note"><strong>Quy tắc thay thế</strong><p>Mỗi lời mời hợp lệ thay thế một quản lý đào tạo. Lời mời sẽ được gửi qua email.</p></div>
          <div className="admin-form-actions"><AdminButton onClick={() => navigate(-1)}>Hủy</AdminButton><AdminButton type="primary" htmlType="submit">Gửi lời mời</AdminButton></div>
        </Form>
      </SectionCard>
    </AdminPage>
  );
};
export default ReplaceOrganizer;
