import { useState } from "react";
import { message } from "antd";
import { useNavigate } from "react-router-dom";
import { monitoringFilters } from "@/components/instructor/instructor.data";
import { InstructorButton, InstructorPage, PageHeader, SectionCard } from "@/components/instructor/instructor.ui";
import "./monitoring.export.scss";

type ExportFormat = "Excel" | "PDF";

const MonitoringExport = () => {
  const navigate = useNavigate();
  const [format, setFormat] = useState<ExportFormat>("Excel");

  const exportReport = () => {
    message.success(`Course report exported as ${format}.`);
    navigate("/instructor/monitoring");
  };

  return (
    <InstructorPage className="instructor-monitoring-export">
      <PageHeader
        eyebrow="Giảng viên"
        title="Xuất báo cáo khóa học"
        subtitle="Chỉ xuất dữ liệu đã lọc từ các khóa học bạn phụ trách."
        back
      />
      <SectionCard className="instructor-export-card">
        <h2>Phạm vi báo cáo</h2>
        <p>Selected Course: {monitoringFilters.courseTitle ?? "All Courses"}</p>
        <p>
          Enrollment type: {monitoringFilters.enrollmentType ?? "[Filter]"} • Status:{" "}
          {monitoringFilters.completionStatus ?? "[Filter]"}
        </p>
        <hr />
        <h3>Định dạng tệp</h3>
        <div className="instructor-export-formats">
          {(["Excel", "PDF"] as ExportFormat[]).map((option) => (
            <button
              key={option}
              type="button"
              className={`instructor-export-format ${format === option ? "instructor-export-format-active" : ""}`}
              onClick={() => setFormat(option)}
            >
              {option}
            </button>
          ))}
        </div>
        <div className="instructor-export-actions">
          <InstructorButton type="primary" onClick={exportReport}>
            Xuất báo cáo
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default MonitoringExport;
