import { Input, message } from "antd";
import { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import type { IBasicDraft } from "./course.create.basic";
import {
  InstructorButton,
  InstructorPage,
  PageHeader,
  SectionCard,
} from "@/components/instructor/instructor.ui";
import "./course.create.scss";

const CourseCreateOutcomes = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const state = location.state as { basic?: IBasicDraft; outcomes?: string[] } | null;

  if (!state?.basic) {
    navigate("/instructor/courses/create", { replace: true });
  }

  const [outcomes, setOutcomes] = useState<string[]>(
    state?.outcomes ?? ["Recognize required safety procedures.", "Apply procedures in workplace scenarios.", ""],
  );

  const updateOutcome = (index: number, value: string) => {
    setOutcomes((prev) => prev.map((item, i) => (i === index ? value : item)));
  };

  const addOutcome = () => {
    if (outcomes.length >= 6) {
      message.info("Up to 6 Learning Outcomes are supported.");
      return;
    }
    setOutcomes((prev) => [...prev, ""]);
  };

  const handleContinue = () => {
    if (!outcomes[0]?.trim() || !outcomes[1]?.trim()) {
      message.warning("Enter at least two Learning Outcomes.");
      return;
    }
    navigate("/instructor/courses/create/settings", {
      state: { basic: state?.basic, outcomes: outcomes.filter((item) => item.trim()) },
    });
  };

  return (
    <InstructorPage className="instructor-course-create">
      <PageHeader
        eyebrow="CREATE COURSE / OUTCOMES"
        title="Course Learning Outcomes"
        subtitle="Describe what a Learner should achieve."
        back
      />
      <div className="instructor-course-create-grid">
        <SectionCard title="Learning Outcomes" className="instructor-course-create-main">
          {outcomes.map((outcome, index) => (
            <div className="instructor-outcome-field" key={`outcome-${index}`}>
              <label>Outcome {index + 1}</label>
              <Input
                placeholder={index < 2 ? `Outcome ${index + 1}` : `Enter outcome ${index + 1}`}
                value={outcome}
                onChange={(event) => updateOutcome(index, event.target.value)}
              />
            </div>
          ))}
          <InstructorButton onClick={addOutcome}>+ Add outcome</InstructorButton>
          <div className="instructor-form-actions">
            <InstructorButton onClick={() => navigate(-1)}>Back</InstructorButton>
            <InstructorButton type="primary" onClick={handleContinue}>
              Continue
            </InstructorButton>
          </div>
        </SectionCard>
        <SectionCard title="Course structure" className="instructor-course-create-side">
          <p>Outcomes appear on the Course overview before a Learner enrolls.</p>
        </SectionCard>
      </div>
    </InstructorPage>
  );
};

export default CourseCreateOutcomes;
