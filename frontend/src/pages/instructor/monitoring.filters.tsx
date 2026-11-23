import { Form, Select } from "antd";
import { useNavigate } from "react-router-dom";
import {
  applyMonitoringFilters,
  monitoringCourseOptions,
  monitoringFilters,
  monitoringLearnerOptions,
  resetMonitoringFilters,
  type IMonitoringFilters,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage, PageHeader, SectionCard } from "@/components/instructor/instructor.ui";
import "./monitoring.filters.scss";

const MonitoringFilters = () => {
  const navigate = useNavigate();
  const [form] = Form.useForm<IMonitoringFilters>();

  const submit = (values: IMonitoringFilters) => {
    applyMonitoringFilters(values);
    navigate("/instructor/monitoring");
  };

  const reset = () => {
    resetMonitoringFilters();
    form.resetFields();
  };

  return (
    <InstructorPage className="instructor-monitoring-filters">
      <PageHeader
        eyebrow="Giảng viên"
        title="Lọc thông tin theo dõi học tập"
        subtitle="Lọc kết quả theo học viên và khóa học bạn phụ trách."
        back
      />
      <SectionCard>
        <Form<IMonitoringFilters>
          form={form}
          layout="vertical"
          requiredMark={false}
          initialValues={monitoringFilters}
          onFinish={submit}
        >
          <div className="instructor-monitoring-filters-grid">
            <Form.Item label="Khóa học" name="courseTitle">
              <Select
                allowClear
                placeholder="Tất cả khóa học"
                options={monitoringCourseOptions().map((title) => ({ value: title, label: title }))}
              />
            </Form.Item>
            <Form.Item label="Học viên" name="learnerName">
              <Select
                allowClear
                placeholder="Tất cả học viên"
                options={monitoringLearnerOptions().map((name) => ({ value: name, label: name }))}
              />
            </Form.Item>
            <Form.Item label="Hình thức đăng ký học" name="enrollmentType">
              <Select
                allowClear
                placeholder="Required / Optional"
                options={[
                  { value: "Required", label: "Required" },
                  { value: "Optional", label: "Optional" },
                ]}
              />
            </Form.Item>
            <Form.Item label="Trạng thái hoàn thành" name="completionStatus">
              <Select
                allowClear
                placeholder="Tất cả trạng thái"
                options={[
                  { value: "Not started", label: "Chưa bắt đầu" },
                  { value: "In progress", label: "Đang học" },
                  { value: "Completed", label: "Hoàn thành" },
                ]}
              />
            </Form.Item>
          </div>
          <InfoPanel title="Phạm vi">
            Báo cáo không bao gồm khóa học do giảng viên khác phụ trách.
          </InfoPanel>
          <div className="instructor-monitoring-filters-actions">
            <InstructorButton onClick={reset}>Đặt lại</InstructorButton>
            <InstructorButton type="primary" htmlType="submit">
              Áp dụng bộ lọc
            </InstructorButton>
          </div>
        </Form>
      </SectionCard>
    </InstructorPage>
  );
};

export default MonitoringFilters;
