import { Form, Input, Select } from "antd";
import { useNavigate } from "react-router-dom";
import { AdminButton, AdminPage, DetailItem, PageHeader, SectionCard, StatusTag } from "@/components/admin/admin.ui";
import "./report.detail.scss";

const ReportDetail = () => {
  const navigate = useNavigate();
  return <AdminPage className="admin-report-detail">
    <PageHeader title="Báo cáo REP-1042" subtitle="Báo cáo chuyển cấp · Northstar Learning" actions={<><StatusTag tone="warning">Đã chuyển cấp</StatusTag><AdminButton onClick={() => navigate(-1)}>Về danh sách chờ</AdminButton></>} />
    <div className="admin-content-grid">
      <SectionCard title="Nội dung bị báo cáo"><div className="admin-report-copy"><span>Khóa học</span><strong>Kiến thức thiết yếu về an toàn lao động</strong><span>Mục bị báo cáo</span><strong>Bài học 4 / Tài liệu đọc</strong><span>Lý do báo cáo</span><p>Người báo cáo cho rằng nội dung có hướng dẫn vận hành thiếu an toàn.</p><span>Nguồn chuyển cấp</span><p>Người báo cáo yêu cầu chuyển cấp sau quyết định của quản lý đào tạo.</p></div></SectionCard>
      <SectionCard title="Thông tin tổ chức"><div className="admin-stack"><DetailItem label="Tổ chức">Northstar Learning</DetailItem><DetailItem label="Giảng viên">An Trần</DetailItem><DetailItem label="Quyết định trước đó của quản lý đào tạo">Không có vi phạm</DetailItem><DetailItem label="Thời điểm chuyển cấp">21/09/2026 09:30</DetailItem></div></SectionCard>
    </div>
    <SectionCard title="Quyết định cuối cùng của nền tảng" className="admin-decision-card"><Form className="admin-form" layout="vertical" onFinish={() => navigate("/admin/reports")}><Form.Item label="Quyết định" name="decision" rules={[{ required: true }]}><Select placeholder="Xác nhận vi phạm" options={[{ value: "violation", label: "Xác nhận vi phạm" },{ value: "no-violation", label: "Không có vi phạm" }]} /></Form.Item><Form.Item label="Ghi chú nội bộ về quyết định" name="note"><Input.TextArea rows={4} placeholder="Giải thích quyết định cuối cùng và nội dung liên quan." /></Form.Item><div className="admin-form-actions"><AdminButton>Bác bỏ báo cáo</AdminButton><AdminButton type="primary" htmlType="submit">Xử lý và vô hiệu hóa nội dung</AdminButton></div></Form></SectionCard>
    <p className="admin-note admin-report-footer">Sau khi xử lý, LearnUP thông báo cho người báo cáo và giảng viên phụ trách nội dung. Một vi phạm riêng lẻ không tự động dẫn đến việc tạm khóa cả tổ chức.</p>
  </AdminPage>;
};
export default ReportDetail;
