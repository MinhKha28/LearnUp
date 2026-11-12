import { formatNumberVN } from "@/utils/number.format";
import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/organizer/organizer.ui";
import "./evaluations.scss";

type VersionRow = {
  key: string;
  version: string;
  responses: string;
  usefulness: number;
  difficulty: number;
  materials: number;
  comments: number;
};

const versionRows: VersionRow[] = [
  { key: "v2", version: "v2", responses: "39 / 54", usefulness: 4.4, difficulty: 4.1, materials: 4.3, comments: 31 },
  { key: "v1", version: "v1", responses: "26 / 42", usefulness: 4.2, difficulty: 4.0, materials: 4.1, comments: 20 },
];

const comments = [
  { key: "1", text: "Các ví dụ thiết thực và dễ áp dụng vào công việc hằng ngày.", date: "27/09/2026" },
  { key: "2", text: "Bài tập cuối khóa hữu ích, nhưng nội dung chương 3 hơi dày.", date: "23/09/2026" },
  { key: "3", text: "Video rõ nét và danh sách kiểm tra an toàn rất hữu ích.", date: "19/09/2026" },
  { key: "4", text: "Tôi mong phiên bản sau có thêm ví dụ theo tình huống thực tế.", date: "15/09/2026" },
];

/** A 1-5 rating with one decimal and the Vietnamese comma: 4 -> "4,0". */
const rating = (value: number) => formatNumberVN(value, 1, 1);

const Evaluations = () => {
  const columns: ColumnsType<VersionRow> = [
    { title: "Phiên bản", dataIndex: "version" },
    { title: "Phản hồi", dataIndex: "responses" },
    { title: "Mức độ hữu ích", dataIndex: "usefulness", render: rating },
    { title: "Độ khó", dataIndex: "difficulty", render: rating },
    { title: "Học liệu", dataIndex: "materials", render: rating },
    { title: "Nhận xét", dataIndex: "comments" },
  ];
  return (
    <OrganizerPage className="organizer-evaluations">
      <PageHeader
        title="Đánh giá khóa học"
        subtitle="Phản hồi ẩn danh của học viên trong tổ chức sau khi hoàn thành khóa học."
        actions={<OrganizerButton type="primary">Xuất kết quả</OrganizerButton>}
      />
      <SectionCard className="organizer-evaluations-header">
        <div className="organizer-detail-grid">
          <div className="organizer-detail-item">
            <span>Khóa học</span>
            <strong>Kiến thức cơ bản về an toàn lao động</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Phiên bản</span>
            <strong>Phiên bản 2 · Đã phát hành</strong>
          </div>
          <div className="organizer-detail-item">
            <span>Phản hồi</span>
            <strong>39 trên 54 học viên đã hoàn thành</strong>
          </div>
        </div>
      </SectionCard>
      <div className="organizer-stat-grid organizer-evaluations-stats">
        <StatCard label="Mức độ hữu ích của nội dung" value={`${rating(4.4)} / 5`} />
        <StatCard label="Mức độ phù hợp của độ khó" value={`${rating(4.1)} / 5`} />
        <StatCard label="Chất lượng học liệu" value={`${rating(4.3)} / 5`} />
        <StatCard label="Tỷ lệ phản hồi" value="70%" tone="success" />
      </div>
      <SectionCard title="So sánh phiên bản">
        <Table className="organizer-table" columns={columns} dataSource={versionRows} pagination={false} />
        <p className="organizer-note organizer-evaluations-note">
          Nhận xét tự do được ẩn danh; không hiển thị danh tính học viên
          trong bảng so sánh theo phiên bản này.
        </p>
      </SectionCard>
      <SectionCard
        title="Nhận xét ẩn danh"
        extra={<span className="organizer-note">31 nhận xét ẩn danh</span>}
      >
        <div className="organizer-comments-list">
          {comments.map((comment) => (
            <div key={comment.key}>
              <div>
                <p>{comment.text}</p>
                <span>{comment.date}</span>
              </div>
              <small>Ẩn danh</small>
            </div>
          ))}
        </div>
        <p className="organizer-note organizer-evaluations-note">
          Danh tính học viên được ẩn trong phiên bản này.
        </p>
      </SectionCard>
    </OrganizerPage>
  );
};

export default Evaluations;
