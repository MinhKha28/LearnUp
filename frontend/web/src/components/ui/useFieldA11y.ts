import { useId } from 'react';

interface FieldA11yOptions {
  id?: string;
  helperText?: React.ReactNode;
  error?: React.ReactNode;
  /** aria-describedby passed by the caller, kept in front of ours. */
  describedBy?: string;
}

/** Stable ids for a form control and the aria-* attributes that tie it to its messages. */
export const useFieldA11y = ({ id, helperText, error, describedBy }: FieldA11yOptions) => {
  const generatedId = useId();
  const controlId = id ?? generatedId;
  const helperId = `${controlId}-helper`;
  const errorId = `${controlId}-error`;

  const ariaDescribedBy =
    [describedBy, helperText ? helperId : null, error ? errorId : null].filter(Boolean).join(' ') ||
    undefined;

  return {
    controlId,
    helperId,
    errorId,
    controlProps: {
      id: controlId,
      'aria-describedby': ariaDescribedBy,
      'aria-invalid': error ? (true as const) : undefined,
    },
  };
};
