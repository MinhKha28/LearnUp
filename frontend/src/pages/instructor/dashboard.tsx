import { Table } from "antd";
import type { ColumnsType } from "antd/es/table";
import { useNavigate } from "react-router-dom";
import {
  courseStatusLabel,
  coursesRequiringAttention,
  draftCourseCount,
  gradingHighlights,
  instructorCourses,
  instructorSubmissions,
  submittedCourseCount,
} from "@/components/instructor/instructor.data";
import {
  InfoPanel,
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
  StatCard,
} from "@/components/instructor/instructor.ui";
import "./dashboard.scss";

const attentionNextAction: Record<string, string> = {
  draft: "Tiếp tục chỉnh sửa",
  submitted: "Xem trạng thái",
  rejected: "Xem lý do",
};

interface IAttentionRow {
  key: string;
  course: string;
  status: string;
  nextAction: string;
}

const Dashboard = () => {
  const navigate = useNavigate();

  const attentionRows: IAttentionRow[] = coursesRequiringAttention().map((course) => ({
    key: course.id,
    course: course.title,
    status: courseStatusLabel[course.status],
    nextAction: attentionNextAction[course.status] ?? "Xem khóa học",
  }));

  const columns: ColumnsType<IAttentionRow> = [
    { title: "Khóa học", dataIndex: "course", render: (value) => <strong>{value}</strong> },
    { title: "Trạng thái", dataIndex: "status" },
    {
      title: "Thao tác tiếp theo",
      dataIndex: "nextAction",
      render: (value, record) => (
        <button
          type="button"
          className="instructor-attention-action"
          onClick={() => {
            const course = coursesRequiringAttention().find((item) => item.title === record.course);
            if (course) navigate(`/instructor/courses/${course.id}`);
          }}
        >
          {value}
        </button>
      ),
    },
  ];

  return (
    <InstructorPage className="instructor-dashboard">
      <PageHeader
        eyebrow="Giảng viên"
        title="Tổng quan giảng viên"
        subtitle="Theo dõi khóa học, việc chấm bài và tiến độ học viên tại một nơi."
      />
      <InfoPanel title="Phê duyệt khóa học">
        Khóa học đã gửi đang chờ quản lý đào tạo phê duyệt.
      </InfoPanel>
      <div className="instructor-dashboard-stats">
        <StatCard
          label="Khóa học bản nháp"
          value={draftCourseCount()}
          to={{
            label: "Tiếp tục biên soạn",
            onClick: () => {
              const draft = instructorCourses.find((course) => course.status === "draft");
              navigate(draft ? `/instructor/courses/${draft.id}/builder` : "/instructor/courses");
            },
          }}
        />
        <StatCard
          label="Khóa học chờ phê duyệt"
          value={submittedCourseCount()}
          to={{ label: "Đang chờ thẩm định", onClick: () => navigate("/instructor/courses") }}
        />
        <StatCard
          label="Bài nộp cần chấm"
          value={instructorSubmissions.filter((submission) => !submission.published).length}
          to={{
            label: "Xem để chấm",
            onClick: () => navigate("/instructor/submissions"),
          }}
        />
        <StatCard
          label="Học viên cần hỗ trợ"
          value="[Count]"
          to={{ label: "Xem báo cáo", onClick: () => navigate("/instructor/monitoring") }}
        />
      </div>
      <div className="instructor-dashboard-grid">
        <SectionCard title="Khóa học cần xử lý" className="instructor-attention-card">
          <Table
            className="instructor-table"
            columns={columns}
            dataSource={attentionRows}
            pagination={false}
            rowKey="key"
          />
        </SectionCard>
        <SectionCard title="Chấm điểm và chấm chéo" className="instructor-grading-card">
          <p className="instructor-grading-assignment">Bài tập an toàn lao động</p>
          <ul className="instructor-grading-list">
            {gradingHighlights.map((item) => (
              <li key={item.label}>
                <button
                  type="button"
                  className="instructor-grading-link"
                  onClick={() => navigate(item.to)}
                >
                  {item.label}
                </button>
              </li>
            ))}
          </ul>
          <InstructorButton
            block
            onClick={() => navigate("/instructor/submissions")}
          >
            Xem bài nộp
          </InstructorButton>
        </SectionCard>
      </div>
    </InstructorPage>
  );
};

export default Dashboard;
