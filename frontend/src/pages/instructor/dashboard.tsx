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
  draft: "Continue editing",
  submitted: "View status",
  rejected: "Review reason",
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
    nextAction: attentionNextAction[course.status] ?? "View course",
  }));

  const columns: ColumnsType<IAttentionRow> = [
    { title: "Course", dataIndex: "course", render: (value) => <strong>{value}</strong> },
    { title: "Status", dataIndex: "status" },
    {
      title: "Next action",
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
        eyebrow="INSTRUCTOR"
        title="Instructor Overview"
        subtitle="Your Courses, reviews and Learner progress in one place."
      />
      <InfoPanel title="Course approval">
        A submitted Course is awaiting the Organizer&apos;s decision.
      </InfoPanel>
      <div className="instructor-dashboard-stats">
        <StatCard
          label="Draft Courses"
          value={draftCourseCount()}
          to={{
            label: "Continue authoring",
            onClick: () => {
              const draft = instructorCourses.find((course) => course.status === "draft");
              navigate(draft ? `/instructor/courses/${draft.id}/builder` : "/instructor/courses");
            },
          }}
        />
        <StatCard
          label="Submitted Course"
          value={submittedCourseCount()}
          to={{ label: "Awaiting review", onClick: () => navigate("/instructor/courses") }}
        />
        <StatCard
          label="Submissions to grade"
          value={instructorSubmissions.filter((submission) => !submission.published).length}
          to={{
            label: "Review now",
            onClick: () => navigate("/instructor/submissions"),
          }}
        />
        <StatCard
          label="At-risk Learners"
          value="[Count]"
          to={{ label: "Open report", onClick: () => navigate("/instructor/monitoring") }}
        />
      </div>
      <div className="instructor-dashboard-grid">
        <SectionCard title="Courses requiring attention" className="instructor-attention-card">
          <Table
            className="instructor-table"
            columns={columns}
            dataSource={attentionRows}
            pagination={false}
            rowKey="key"
          />
        </SectionCard>
        <SectionCard title="Grading and peer review" className="instructor-grading-card">
          <p className="instructor-grading-assignment">Safety Assignment</p>
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
            View submissions
          </InstructorButton>
        </SectionCard>
      </div>
    </InstructorPage>
  );
};

export default Dashboard;
