import { InfoPanel, InstructorButton, InstructorPage, PageHeader, SectionCard } from "@/components/instructor/instructor.ui";
import "./monitoring.export.scss";

const EvaluationExport = () => {
  return (
    <InstructorPage className="instructor-evaluation-export">
      <PageHeader
        eyebrow="Giảng viên"
        title="Xuất kết quả đánh giá khóa học"
        subtitle=""
        back
      />
      <SectionCard className="instructor-export-card">
        <p>Điểm đánh giá và nhận xét không gắn danh tính học viên.</p>
        <hr />
        <h3>Định dạng</h3>
        <div className="instructor-export-formats">
          {["Excel", "PDF"].map((format) => (
            <InstructorButton key={format} disabled aria-describedby="evaluation-export-unavailable">
              {format}
            </InstructorButton>
          ))}
        </div>
        <div id="evaluation-export-unavailable">
          <InfoPanel title="Chưa hỗ trợ xuất kết quả đánh giá">
            Tính năng xuất kết quả đánh giá đang được phát triển. Hiện hệ thống chưa tạo được tệp Excel hoặc PDF.
          </InfoPanel>
        </div>
        <div className="instructor-export-actions" style={{ marginTop: "var(--space-4)" }}>
          <InstructorButton disabled aria-describedby="evaluation-export-unavailable">
            Xuất kết quả đánh giá
          </InstructorButton>
        </div>
      </SectionCard>
    </InstructorPage>
  );
};

export default EvaluationExport;
