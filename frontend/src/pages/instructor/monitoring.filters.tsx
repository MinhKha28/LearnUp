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
        eyebrow="INSTRUCTOR"
        title="Filter Course Monitoring"
        subtitle="Narrow results to the people and Courses you own."
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
            <Form.Item label="Course" name="courseTitle">
              <Select
                allowClear
                placeholder="All Courses"
                options={monitoringCourseOptions().map((title) => ({ value: title, label: title }))}
              />
            </Form.Item>
            <Form.Item label="Learner" name="learnerName">
              <Select
                allowClear
                placeholder="All Learners"
                options={monitoringLearnerOptions().map((name) => ({ value: name, label: name }))}
              />
            </Form.Item>
            <Form.Item label="Enrollment type" name="enrollmentType">
              <Select
                allowClear
                placeholder="Required / Optional"
                options={[
                  { value: "Required", label: "Required" },
                  { value: "Optional", label: "Optional" },
                ]}
              />
            </Form.Item>
            <Form.Item label="Completion status" name="completionStatus">
              <Select
                allowClear
                placeholder="All statuses"
                options={[
                  { value: "Not started", label: "Not started" },
                  { value: "In progress", label: "In progress" },
                  { value: "Completed", label: "Completed" },
                ]}
              />
            </Form.Item>
          </div>
          <InfoPanel title="Scope">
            Reports do not include Courses assigned to other Instructors.
          </InfoPanel>
          <div className="instructor-monitoring-filters-actions">
            <InstructorButton onClick={reset}>Reset</InstructorButton>
            <InstructorButton type="primary" htmlType="submit">
              Apply filters
            </InstructorButton>
          </div>
        </Form>
      </SectionCard>
    </InstructorPage>
  );
};

export default MonitoringFilters;
