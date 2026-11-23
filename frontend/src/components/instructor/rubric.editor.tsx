import { Input } from "antd";
import type { IRubricRow } from "@/types/assessment.types";
import { newRubricRow } from "@/utils/helper";
import { RUBRIC_MAX_CRITERIA, RUBRIC_POINTS_RULE } from "@/utils/validation";
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
            <strong className="builder-rubric-title">Tiêu chí {index + 1}</strong>
            <div className="builder-rubric-fields">
              <div className="builder-rubric-field-description">
                <label className="instructor-form-label">Mô tả</label>
                <Input
                  value={row.description}
                  maxLength={200}
                  disabled={disabled}
                  status={descriptionMissing ? "error" : undefined}
                  placeholder="Mức độ đầy đủ của câu trả lời"
                  onChange={(event) => update(row.key, { description: event.target.value })}
                />
                <FieldError message={descriptionMissing ? "Nhập mô tả cho tiêu chí này." : null} />
              </div>
              <div className="builder-rubric-field-score">
                <label className="instructor-form-label">Điểm tối đa</label>
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
                Xóa tiêu chí
              </InstructorButton>
            )}
          </div>
        );
      })}
      {!disabled && (
        <InstructorButton disabled={rows.length >= RUBRIC_MAX_CRITERIA} onClick={() => onChange([...rows, newRubricRow()])}>
          + Thêm tiêu chí
        </InstructorButton>
      )}
    </>
  );
};

export default RubricEditor;
