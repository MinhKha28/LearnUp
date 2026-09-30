import { Checkbox, Form, Input, Select } from "antd";
import { useNavigate } from "react-router-dom";
import {
  OrganizerButton,
  OrganizerPage,
  PageHeader,
  SectionCard,
} from "@/components/organizer/organizer.ui";
import "./assignment.create.scss";

type Candidate = {
  key: string;
  name: string;
  workUnit: string;
  note: string;
};

const candidates: Candidate[] = [
  { key: "minh-le", name: "Minh Le", workUnit: "Engineering", note: "Already Optional — will convert to Required" },
  { key: "trang-nguyen", name: "Trang Nguyen", workUnit: "HR", note: "Not enrolled" },
  { key: "bao-tran", name: "Bao Tran", workUnit: "Operations", note: "Not enrolled" },
];

const AssignmentCreate = () => {
  const navigate = useNavigate();
  return (
    <OrganizerPage className="organizer-assignment-create">
      <PageHeader
        title="Assign Required Course"
        subtitle="Assign a Published Course to one or more Learners."
        actions={
          <>
            <OrganizerButton onClick={() => navigate(-1)}>Cancel</OrganizerButton>
            <OrganizerButton
              type="primary"
              onClick={() => navigate("/organizer/assignments")}
            >
              Assign
            </OrganizerButton>
          </>
        }
      />
      <SectionCard title="Assignment setup">
        <Form className="organizer-form" layout="vertical">
          <Form.Item label="Published Course" required>
            <Select
              placeholder="Select a Published Course"
              options={[
                { value: "wse", label: "Workplace Safety Essentials · Published · 14 required days" },
                { value: "fsr", label: "Fire Safety Refresher · Published · 21 required days" },
              ]}
            />
          </Form.Item>
          <Form.Item label="Select Learners" required>
            <Input placeholder="Search by name, email, or work unit" />
          </Form.Item>
        </Form>
        <div className="organizer-assignment-candidates">
          {candidates.map((item) => (
            <label key={item.key}>
              <Checkbox />
              <div>
                <strong>{item.name}</strong>
                <span>{item.workUnit}</span>
              </div>
              <small>{item.note}</small>
            </label>
          ))}
        </div>
        <div className="organizer-assignment-note">
          <p>
            Due date is calculated per Enrollment: assignment date + Course
            expected completion days.
          </p>
          <p>
            Existing Optional progress/results are preserved when converted
            to Required.
          </p>
        </div>
      </SectionCard>
    </OrganizerPage>
  );
};

export default AssignmentCreate;
