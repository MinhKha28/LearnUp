import { InputNumber, Input, message } from "antd";
import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  findBuilderAssignment,
  findCourseStructure,
  findInstructorCourse,
  slugify,
  type IBuilderRubricCriterion,
} from "@/components/instructor/instructor.data";
import { InfoPanel, InstructorButton, InstructorPage } from "@/components/instructor/instructor.ui";
import "./course.builder.scss";

const CourseBuilderAssignmentRubricEdit = () => {
  const { courseId, assignmentId } = useParams();
  const navigate = useNavigate();
  const course = findInstructorCourse(courseId);
  const structure = findCourseStructure(courseId);
  const assignment = structure ? findBuilderAssignment(structure, assignmentId) : undefined;

  const [criteria, setCriteria] = useState<IBuilderRubricCriterion[]>(
    assignment && assignment.rubric.length > 0
      ? assignment.rubric
      : [{ id: slugify("criterion"), description: "", maxScore: undefined }],
  );

  if (!course || !structure || !assignment) return null;

  const base = `/instructor/courses/${course.id}/builder`;

  const updateCriterion = (id: string, patch: Partial<IBuilderRubricCriterion>) => {
    setCriteria((current) =>
      current.map((criterion) => (criterion.id === id ? { ...criterion, ...patch } : criterion)),
    );
  };

  const addCriterion = () => {
    setCriteria((current) => [
      ...current,
      { id: slugify("criterion"), description: "", maxScore: undefined },
    ]);
  };

  const handleSave = () => {
    if (criteria.some((criterion) => !criterion.description.trim())) {
      message.warning("Every criterion needs a description.");
      return;
    }
    assignment.rubric = criteria;
    message.success("Rubric saved.");
    navigate(`${base}/assignments/${assignment.id}/peer-review`);
  };

  return (
    <InstructorPage className="builder-page">
      <span className="builder-crumb">Course Builder / Assignment Rubric</span>
      <div className="builder-hero">
        <h1>Assignment Rubric</h1>
      </div>
      <div className="builder-grid">
        <div className="builder-update-card">
          <h2>Scoring criteria</h2>
          {criteria.map((criterion, index) => (
            <div className="builder-rubric-card" key={criterion.id}>
              <strong className="builder-rubric-title">Criterion {index + 1}</strong>
              <div className="builder-rubric-fields">
                <div className="builder-rubric-field-description">
                  <label className="instructor-form-label">Description</label>
                  <Input
                    value={criterion.description}
                    placeholder="Completeness of response"
                    onChange={(event) => updateCriterion(criterion.id, { description: event.target.value })}
                  />
                </div>
                <div className="builder-rubric-field-score">
                  <label className="instructor-form-label">Maximum score</label>
                  <InputNumber
                    style={{ width: "100%" }}
                    placeholder="[Points]"
                    min={0}
                    value={criterion.maxScore}
                    onChange={(value) =>
                      updateCriterion(criterion.id, { maxScore: typeof value === "number" ? value : undefined })
                    }
                  />
                </div>
              </div>
            </div>
          ))}
          <div className="builder-actions builder-actions-split">
            <InstructorButton onClick={() => navigate(-1)}>Back</InstructorButton>
            <InstructorButton onClick={addCriterion}>+ Add criterion</InstructorButton>
            <InstructorButton type="primary" onClick={handleSave}>
              Save Rubric
            </InstructorButton>
          </div>
        </div>
        <div className="builder-side">
          <InfoPanel title="Grade source">The final score is based on Instructor-published results.</InfoPanel>
        </div>
      </div>
    </InstructorPage>
  );
};

export default CourseBuilderAssignmentRubricEdit;
