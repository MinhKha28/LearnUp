import { FilterOutlined } from "@ant-design/icons";
import { Select, Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  ProgressLine,
  SectionCard,
  StatCard,
  StatusTag,
} from "@/components/organizer/organizer.ui";
import { enrollmentKindText } from "@/utils/organizer.labels";
import "./reports.scss";

type CourseReportRow = {
  key: string;
  course: string;
  enrollmentType: "Required" | "Optional";
  learners: number;
  completion: string;
  overdue: number;
};

const courseRows: CourseReportRow[] = [
  { key: "wse", course: "Kiến thức cơ bản về an toàn lao động", enrollmentType: "Required", learners: 86, completion: "63%", overdue: 8 },
  { key: "dsc", course: "Tuân thủ bảo mật dữ liệu", enrollmentType: "Required", learners: 142, completion: "88%", overdue: 6 },
  { key: "hrp", course: "Phòng chống quấy rối", enrollmentType: "Required", learners: 90, completion: "79%", overdue: 9 },
  { key: "lft", course: "Kiến thức nền tảng về lãnh đạo", enrollmentType: "Optional", learners: 41, completion: "54%", overdue: 0 },
];

const Reports = () => {
  const navigate = useNavigate();
  const courseColumns: ColumnsType<CourseReportRow> = [
    { title: "Khóa học", dataIndex: "course" },
    { title: "Hình thức tham gia", dataIndex: "enrollmentType", render: (value: string) => enrollmentKindText(value) },
    { title: "Học viên", dataIndex: "learners" },
    { title: "Mức độ hoàn thành", dataIndex: "completion" },
    {
      title: "Quá hạn",
      dataIndex: "overdue",
      render: (value: number) => (
        <StatusTag tone={value > 0 ? "error" : "success"}>{value}</StatusTag>
      ),
    },
    {
      title: "",
      key: "action",
      align: "right",
      render: (_, item) => (
        <button
          className="organizer-link"
          onClick={() => navigate(`/organizer/reports/${item.key}`)}
        >
          Xem báo cáo →
        </button>
      ),
    },
  ];
  return (
    <OrganizerPage className="organizer-reports">
      <PageHeader
        title="Báo cáo đào tạo"
        subtitle="Báo cáo đào tạo toàn tổ chức, gồm kết quả đào tạo bắt buộc và đào tạo tự chọn."
        actions={
          <>
            <OrganizerButton>Xuất PDF</OrganizerButton>
            <OrganizerButton type="primary">Xuất Excel</OrganizerButton>
          </>
        }
      />
      <div className="organizer-stat-grid organizer-reports-stats">
        <StatCard label="Học viên" value="318" />
        <StatCard label="Khóa học đang triển khai" value="14" />
        <StatCard label="Hoàn thành đào tạo bắt buộc" value="82%" tone="success" />
        <StatCard label="Chứng chỉ đã cấp" value="196" />
        <StatCard label="Quá hạn" value="23" tone="error" />
      </div>
      <SectionCard className="organizer-reports-filters">
        <div className="organizer-reports-filter-bar">
          <span className="organizer-reports-filter-label">
            <FilterOutlined />
            Bộ lọc
          </span>
          <Select
            variant="borderless"
            placeholder="Khoảng thời gian"
            popupMatchSelectWidth={false}
            options={[{ value: "30", label: "30 ngày qua" }, { value: "90", label: "90 ngày qua" }]}
          />
          <Select
            variant="borderless"
            placeholder="Khóa học"
            popupMatchSelectWidth={false}
            options={courseRows.map((item) => ({ value: item.key, label: item.course }))}
          />
          <Select
            variant="borderless"
            placeholder="Hình thức tham gia"
            popupMatchSelectWidth={false}
            options={[{ value: "required", label: "Bắt buộc" }, { value: "optional", label: "Tự chọn" }]}
          />
          <Select
            variant="borderless"
            placeholder="Đơn vị công tác"
            popupMatchSelectWidth={false}
            options={[{ value: "all", label: "Tất cả đơn vị công tác" }]}
          />
          <Select
            variant="borderless"
            placeholder="Trạng thái hoàn thành"
            popupMatchSelectWidth={false}
            options={[{ value: "on-time", label: "Hoàn thành đúng hạn" }, { value: "overdue", label: "Quá hạn" }]}
          />
          <Select
            variant="borderless"
            placeholder="Mã Chứng chỉ"
            popupMatchSelectWidth={false}
            options={[]}
          />
        </div>
      </SectionCard>
      <SectionCard title="Khóa học" className="organizer-reports-courses">
        <Table
          className="organizer-table"
          columns={courseColumns}
          dataSource={courseRows}
          pagination={false}
        />
      </SectionCard>
      <div className="organizer-content-grid">
        <SectionCard title="Tuân thủ đào tạo bắt buộc">
          <div className="organizer-dashboard-progress">
            <ProgressLine label="Hoàn thành đúng hạn" count="204" value={64} />
            <ProgressLine label="Hoàn thành trễ hạn" count="36" value={11} tone="amber" />
            <ProgressLine label="Quá hạn" count="23" value={7} tone="red" />
            <ProgressLine label="Được miễn" count="12" value={4} tone="blue" />
          </div>
        </SectionCard>
        <SectionCard title="Đào tạo tự chọn">
          <p className="organizer-note">
            Đào tạo tự chọn không ảnh hưởng đến kết quả tuân thủ đào tạo bắt buộc.
          </p>
          <div className="organizer-metric-row organizer-optional-metrics">
            <div className="organizer-metric">
              <span>Lượt tham gia Khóa học tự chọn đang học</span>
              <strong>74</strong>
            </div>
            <div className="organizer-metric">
              <span>Lượt hoàn thành Khóa học tự chọn</span>
              <strong>41</strong>
            </div>
            <div className="organizer-metric">
              <span>Lượt rút khỏi Khóa học tự chọn</span>
              <strong>9</strong>
            </div>
          </div>
        </SectionCard>
      </div>
    </OrganizerPage>
  );
};

export default Reports;
