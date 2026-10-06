import { Input } from "antd";
import type { IRubricRow } from "@/types/assessment.types";
import { newRubricRow } from "@/utils/helper";
import { RUBRIC_POINTS_RULE } from "@/utils/validation";
import { FieldError, NumberField } from "./form.field";
import { InstructorButton } from "./instructor.ui";
import "@/pages/instructor/course.builder.scss";

type TProps = {
  rows: IRubricRow[];
  onChange: (rows: IRubricRow[]) => void;
  disabled?: boolean;
  /** Show every error now, e.g. after the user pressed Save. */
  showErrors?: boolean;
};

/** Rubric criteria list shared by Create (UC19.2) and Edit (UC19.3) Assignment. */
const RubricEditor = ({ rows, onChange, disabled = false, showErrors = false }: TProps) => {
  const update = (key: string, patch: Partial<IRubricRow>) =>
    onChange(rows.map((row) => (row.key === key ? { ...row, ...patch } : row)));

  return (
    <>
      {rows.map((row, index) => {
        const descriptionMissing = showErrors && !disabled && !row.description.trim();
        return (
          <div className="builder-rubric-card" key={row.key}>
            <strong className="builder-rubric-title">Criterion {index + 1}</strong>
            <div className="builder-rubric-fields">
              <div className="builder-rubric-field-description">
                <label className="instructor-form-label">Description</label>
                <Input
                  value={row.description}
                  maxLength={200}
                  disabled={disabled}
                  status={descriptionMissing ? "error" : undefined}
                  placeholder="Completeness of response"
                  onChange={(event) => update(row.key, { description: event.target.value })}
                />
                <FieldError message={descriptionMissing ? "Enter a description for this criterion." : null} />
              </div>
              <div className="builder-rubric-field-score">
                <label className="instructor-form-label">Maximum score</label>
                <NumberField
                  rule={RUBRIC_POINTS_RULE}
                  disabled={disabled}
                  showError={showErrors}
                  value={row.maxPoints}
                  onChange={(value) => update(row.key, { maxPoints: value })}
                />
              </div>
            </div>
            {rows.length > 1 && !disabled && (
              <InstructorButton onClick={() => onChange(rows.filter((r) => r.key !== row.key))}>
                Remove
              </InstructorButton>
            )}
          </div>
        );
      })}
      {!disabled && (
        <InstructorButton disabled={rows.length >= 50} onClick={() => onChange([...rows, newRubricRow()])}>
          + Add criterion
        </InstructorButton>
      )}
    </>
  );
};

export default RubricEditor;
