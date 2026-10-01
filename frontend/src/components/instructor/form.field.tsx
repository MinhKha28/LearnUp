import { InputNumber } from "antd";
import { useRef, useState } from "react";
import { type INumberRule, validateNumber } from "@/utils/validation";
import "@/pages/instructor/course.builder.scss";

/** Text that only partly looks like a number while typing ("12.") still counts as numeric. */
const NUMERIC_TEXT = /^-?\d+\.?\d*$/;

export const FieldError = ({ message }: { message?: string | null }) =>
  message ? <span className="builder-field-error">{message}</span> : null;

type TNumberFieldProps = {
  /** `NaN` means the user typed something that is not a number. */
  value: number | null;
  onChange: (value: number | null) => void;
  rule: INumberRule;
  /** Show the error even if the field was never touched (e.g. after a submit attempt). */
  showError?: boolean;
  placeholder?: string;
  disabled?: boolean;
};

/**
 * Number input that reports what is wrong instead of silently fixing it. Ant Design's own
 * InputNumber clears non-numeric text, rounds decimals and clamps to min/max without telling
 * the user, so those props are left off and the rule is checked here.
 */
export const NumberField = ({ value, onChange, rule, showError = false, placeholder, disabled }: TNumberFieldProps) => {
  const [touched, setTouched] = useState(false);
  const typedText = useRef(false);

  const error = validateNumber(value, rule);
  const visible = !disabled && !!error && (showError || touched || Number.isNaN(value));

  return (
    <>
      <InputNumber
        style={{ width: "100%" }}
        placeholder={placeholder}
        disabled={disabled}
        status={visible ? "error" : undefined}
        value={value === null || Number.isNaN(value) ? undefined : value}
        onInput={(text) => {
          const raw = text.trim();
          typedText.current = raw !== "" && !NUMERIC_TEXT.test(raw);
          // The input only fires onChange when its parsed value changes, and "" -> "abc" is still
          // null -> null, so report the bad text here.
          if (typedText.current) onChange(Number.NaN);
          else if (raw === "" && Number.isNaN(value)) onChange(null);
        }}
        onChange={(next) => {
          // Text such as "abc" can also arrive as null; keep it distinguishable from an empty field.
          if (typeof next === "number") onChange(next);
          else onChange(typedText.current ? Number.NaN : null);
        }}
        onBlur={() => setTouched(true)}
      />
      {visible && <FieldError message={error} />}
    </>
  );
};
