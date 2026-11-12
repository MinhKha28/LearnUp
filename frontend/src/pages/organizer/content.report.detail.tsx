import { Form, Input, Select } from "antd";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import "./content.report.detail.scss";

const ContentReportDetail = () => {
  const navigate = useNavigate();
  return (
    <OrganizerPage className="organizer-content-report-detail">
      <PageHeader
        title="Báo cáo REP-220"
        subtitle="Tài liệu đọc: Các bước bị khóa • Đang chờ"
        back
        actions={<OrganizerButton danger>Chuyển cấp xử lý</OrganizerButton>}
      />
      <div className="organizer-content-grid">
        <SectionCard title="Nội dung bị báo cáo">
          <div className="organizer-detail-grid">
            <div className="organizer-detail-item">
              <span>Khóa học</span>
              <strong>Kiến thức cơ bản về an toàn lao động</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Lý do</span>
              <strong>Có báo cáo về hướng dẫn vận hành không an toàn</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Người phụ trách nội dung</span>
              <strong>Trần An</strong>
            </div>
            <div className="organizer-detail-item">
              <span>Hạn xử lý</span>
              <strong>Còn 8 giờ</strong>
            </div>
          </div>
        </SectionCard>
        <SectionCard title="Lịch sử quyết định">
          <div className="organizer-decision-history">
            <div>
              <span>09:14, 21/09/2026</span>
              <strong>Đã gửi báo cáo</strong>
            </div>
            <p className="organizer-note">Chưa có quyết định.</p>
          </div>
        </SectionCard>
      </div>
      <SectionCard title="Quyết định của Quản lý đào tạo" className="organizer-decision-card">
        <Form
          className="organizer-form"
          layout="vertical"
          onFinish={() => navigate("/organizer/content-reports")}
        >
          <div className="organizer-form-grid">
            <Form.Item label="Quyết định" name="decision" rules={[{ required: true }]}>
              <Select
                placeholder="Xác nhận vi phạm"
                options={[
                  { value: "violation", label: "Xác nhận vi phạm" },
                  { value: "no-violation", label: "Không có vi phạm" },
                ]}
              />
            </Form.Item>
            <Form.Item label="Mức độ" name="severity" rules={[{ required: true }]}>
              <Select
                placeholder="Nhẹ"
                options={[
                  { value: "minor", label: "Nhẹ" },
                  { value: "serious", label: "Nghiêm trọng" },
                ]}
              />
            </Form.Item>
          </div>
          <Form.Item label="Lý do hoặc yêu cầu khắc phục" name="reason">
            <Input.TextArea
              rows={4}
              placeholder="Nhập lý do rõ ràng để gửi cho người báo cáo và người phụ trách nội dung."
            />
          </Form.Item>
          <div className="organizer-form-actions">
            <OrganizerButton>Bác bỏ báo cáo</OrganizerButton>
            <OrganizerButton type="primary" htmlType="submit">
              Xử lý báo cáo
            </OrganizerButton>
          </div>
        </Form>
      </SectionCard>
    </OrganizerPage>
  );
};

export default ContentReportDetail;
