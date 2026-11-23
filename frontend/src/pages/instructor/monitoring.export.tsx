import { monitoringCompletionLabel, monitoringEnrollmentLabel, monitoringFilters } from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage, PageHeader, SectionCard } from "@/components/instructor/instructor.ui";
import "./monitoring.export.scss";

const MonitoringExport = () => {
  return (
    <InstructorPage className="instructor-monitoring-export">
      <PageHeader
        eyebrow="Giảng viên"
        title="Xuất báo cáo khóa học"
        subtitle=""
        back
      />
      <SectionCard className="instructor-export-card">
        <h2>Phạm vi báo cáo</h2>
        <p>Khóa học đã chọn: {monitoringFilters.courseTitle ?? "Tất cả khóa học"}</p>
        <p>
          Hình thức đăng ký học: {monitoringFilters.enrollmentType ? monitoringEnrollmentLabel[monitoringFilters.enrollmentType] : "Tất cả"} • Trạng thái:{" "}
          {monitoringFilters.completionStatus ? monitoringCompletionLabel[monitoringFilters.completionStatus] : "Tất cả"}
        </p>
        <hr />
        <h3>Định dạng tệp</h3>
        <div className="instructor-export-formats">
          {["Excel", "PDF"].map((format) => (
            <InstructorButton key={format} disabled>
              {format}
            </InstructorButton>
          ))}
        </div>
        <div id="report-export-unavailable">
          <InfoPanel title="Chưa hỗ trợ xuất báo cáo">
            Tính năng xuất báo cáo đang được phát triển. Hiện hệ thống chưa tạo được tệp Excel hoặc PDF.
          </InfoPanel>
        </div>
        <div className="instructor-export-actions">
          <InstructorButton disabled aria-describedby="report-export-unavailable">
            Xuất báo cáo
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default MonitoringExport;
