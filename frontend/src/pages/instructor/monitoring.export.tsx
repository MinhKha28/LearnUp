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
        eyebrow="INSTRUCTOR"
        title="Export Course Report"
        subtitle="Export only the filtered data from Courses you own."
        back
      />
      <SectionCard className="instructor-export-card">
        <h2>Report scope</h2>
        <p>Selected Course: {monitoringFilters.courseTitle ?? "All Courses"}</p>
        <p>
          Enrollment type: {monitoringFilters.enrollmentType ?? "[Filter]"} • Status:{" "}
          {monitoringFilters.completionStatus ?? "[Filter]"}
        </p>
        <hr />
        <h3>File format</h3>
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
            Export report
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default MonitoringExport;
