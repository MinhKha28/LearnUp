import { message } from "antd";
import { useRef, useState } from "react";
import { FieldError } from "@/components/instructor/form.field";
import { InstructorButton } from "@/components/instructor/instructor.ui";
import { assessmentErrorText, discardPromptFileAPI, uploadPromptFileAPI } from "@/services/assessment.service";
import type { IPromptFile } from "@/types/assessment.types";
import { formatFileSize } from "@/utils/helper";

/** BR-320: one prompt file per Assignment, PDF only, 50 MB at most (same limits the API enforces). */
const MAX_BYTES = 50 * 1024 * 1024;

type TProps = {
  value: IPromptFile | null;
  onChange: (file: IPromptFile | null) => void;
  disabled?: boolean;
};

/** Picks a PDF, uploads it right away and hands the stored file's description to the form. */
const PromptFileField = ({ value, onChange, disabled }: TProps) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Files uploaded on this screen and not saved yet: they are removed from the storage when replaced or removed.
  const fresh = useRef(new Set<string>());

  const dropIfFresh = (file: IPromptFile | null) => {
    if (file && fresh.current.delete(file.fileKey)) void discardPromptFileAPI(file.fileKey);
  };

  const pick = async (file?: File) => {
    if (!file) return;
    setError(null);
    if (file.size > MAX_BYTES) {
      setError("The file must be 50 MB or smaller.");
      return;
    }
    if (file.type !== "application/pdf" && !/\.pdf$/i.test(file.name)) {
      setError("Only PDF files are accepted.");
      return;
    }
    setBusy(true);
    try {
      const res = await uploadPromptFileAPI(file);
      if (res.data) {
        // The file is only linked to the Assignment once the form is saved.
        void message.success(
          value ? "PDF replaced. Save the Assignment to keep it." : "PDF attached. Save the Assignment to keep it.",
        );
        dropIfFresh(value);
        fresh.current.add(res.data.fileKey);
        onChange(res.data);
      }
      else {
        const text = assessmentErrorText(res, "Unable to upload the file.");
        setError(text);
        void message.error(text);
      }
    } catch {
      setError("Unable to reach the Assessment service. Please try again.");
      void message.error("Unable to upload the PDF.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <label className="instructor-form-label instructor-form-label-spaced">
        Attachment (optional, one PDF up to 50 MB)
      </label>
      <input
        ref={input}
        type="file"
        accept="application/pdf,.pdf"
        hidden
        onChange={(event) => void pick(event.target.files?.[0])}
      />
      <div className="builder-file-row">
        {value ? (
          <>
            <span className="builder-file-name">
              {value.fileName}
              <small> {formatFileSize(value.sizeBytes)}</small>
            </span>
            {!disabled && (
              <>
                <InstructorButton disabled={busy} onClick={() => input.current?.click()}>
                  Replace
                </InstructorButton>
                <InstructorButton disabled={busy} danger onClick={() => {
                    dropIfFresh(value);
                    onChange(null);
                    void message.success("PDF removed. Save the Assignment to apply.");
                  }}
                >
                  Remove
                </InstructorButton>
              </>
            )}
          </>
        ) : (
          <InstructorButton disabled={disabled || busy} onClick={() => input.current?.click()}>
            {busy ? "Uploading..." : "Choose PDF"}
          </InstructorButton>
        )}
      </div>
      <FieldError message={error} />
    </div>
  );
};

export default PromptFileField;
