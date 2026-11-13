import { VietnameseInputNumber } from "@/components/vietnamese.input.number";
import { Form, Select } from "antd";
import { AdminButton, AdminPage, PageHeader, SectionCard } from "@/components/admin/admin.ui";
import "./configuration.scss";

const Configuration = () => <AdminPage className="admin-configuration">
  <PageHeader title="Cấu hình nền tảng" subtitle="Các thông số áp dụng cho mọi tổ chức." actions={<AdminButton type="primary" htmlType="submit" form="configuration-form">Lưu thay đổi</AdminButton>} />
  <Form id="configuration-form" className="admin-form" layout="vertical" initialValues={{ grace: 48, invitation: 100, warning1: 7, warning2: 30, warning3: 60, estimation1: 100, estimation2: 1, estimation3: 20, moderation1: 8, moderation2: 3, moderation3: 7, review1: 7, review2: 24, questions: 5, time: 15, fileSize: 500, video: 120 }}>
    <div className="admin-configuration-grid">
      <SectionCard title="Vòng đời gói dịch vụ"><Field name="grace" label="Thời gian ân hạn" unit="hours" /><Field name="warning1" label="Nhắc gia hạn lần đầu" unit="days" /><Field name="warning2" label="Nhắc gia hạn lần hai" unit="days" /><Field name="warning3" label="Nhắc gia hạn lần cuối" unit="days" /></SectionCard>
      <SectionCard title="Ước tính thời lượng học"><Field name="invitation" label="Số từ mỗi phút" unit="words/min" /><Field name="estimation2" label="Thời lượng tối thiểu của video" unit="hour" /><Field name="estimation3" label="Thời gian dự phòng cho bài đánh giá" unit="%" /></SectionCard>
      <SectionCard title="Kiểm duyệt và chuyển cấp"><Field name="moderation1" label="Thời hạn phản hồi của quản lý đào tạo" unit="days" /><Field name="moderation2" label="Nhắc về chuyển cấp" unit="days" /><Field name="moderation3" label="Hạn chuyển cấp" unit="days" /></SectionCard>
      <SectionCard title="Mặc định cho chấm chéo"><Field name="review1" label="Hạn chấm" unit="days" /><Field name="review2" label="Nhắc trước hạn" unit="hours" /></SectionCard>
      <SectionCard title="Mặc định cho bài đánh giá"><Field name="questions" label="Số câu hỏi mỗi bài trắc nghiệm" unit="questions" /><Field name="time" label="Thời lượng mặc định" unit="minutes" /></SectionCard>
      <SectionCard title="Tải học liệu lên"><Field name="fileSize" label="Giới hạn dung lượng tệp" unit="MB" /><Field name="video" label="Giới hạn thời lượng video" unit="minutes" /></SectionCard>
    </div>
  </Form>
  <div className="admin-config-warning">Thay đổi cấu hình chỉ áp dụng cho dữ liệu tạo sau đó. Trạng thái, kết quả và thời hạn đã ghi nhận được giữ nguyên.</div>
</AdminPage>;

const unitLabels: Record<string, string> = {
  hours: "Giờ",
  hour: "Giờ",
  days: "Ngày",
  "words/min": "Từ/phút",
  questions: "Câu hỏi",
  minutes: "Phút",
  "%": "%",
  MB: "MB",
};

const Field = ({ name, label, unit }: { name: string; label: string; unit: string }) => <Form.Item name={name} label={label}><div className="admin-config-field"><VietnameseInputNumber min={0} /><Select value={unit} options={[{ value: unit, label: unitLabels[unit] }]} /></div></Form.Item>;
export default Configuration;
