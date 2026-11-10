import { message } from "antd";
import { useEffect, useRef, useState } from "react";
import { FieldError } from "@/components/instructor/form.field";
import { InstructorButton } from "@/components/instructor/instructor.ui";
import {
  assessmentErrorText,
  discardPromptFileAPI,
  getPromptFileLimitAPI,
  uploadPromptFileAPI,
} from "@/services/assessment.service";
import type { IPromptFile } from "@/types/assessment.types";
import { formatFileSize } from "@/utils/helper";

/** BR-320: one prompt file per Assignment, PDF, DOCX or ZIP. The size limit comes from the API (the 50 MB ceiling lowered to the storage plan); this is used until it answers. */
const DEFAULT_MAX_BYTES = 50 * 1024 * 1024;
const EXTENSIONS = ["pdf", "docx", "zip"];

type TProps = {
  value: IPromptFile | null;
  onChange: (file: IPromptFile | null) => void;
  disabled?: boolean;
};

/** Picks a PDF, DOCX or ZIP, uploads it right away and hands the stored file's description to the form. */
const PromptFileField = ({ value, onChange, disabled }: TProps) => {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [maxBytes, setMaxBytes] = useState(DEFAULT_MAX_BYTES);

  useEffect(() => {
    let active = true;
    const load = async () => {
      try {
        const res = await getPromptFileLimitAPI();
        if (active && res.data?.maxFileBytes) setMaxBytes(res.data.maxFileBytes);
      } catch {
        // the server checks the size again
      }
    };
    void load();
    return () => {
      active = false;
    };
  }, []);
  const [error, setError] = useState<string | null>(null);
  // Files uploaded on this screen and not saved yet: they are removed from the storage when replaced or removed.
  const fresh = useRef(new Set<string>());

  const dropIfFresh = (file: IPromptFile | null) => {
    if (file && fresh.current.delete(file.fileKey)) void discardPromptFileAPI(file.fileKey);
  };

  const pick = async (file?: File) => {
    if (!file) return;
    setError(null);
    if (file.size > maxBytes) {
      setError(`Tệp quá lớn. Dung lượng tối đa là ${formatFileSize(maxBytes)}.`);
      return;
    }
    if (!EXTENSIONS.includes(file.name.split(".").pop()?.toLowerCase() ?? "")) {
      setError("Chỉ nhận tệp PDF, DOCX hoặc ZIP.");
      return;
    }
    setBusy(true);
    try {
      const res = await uploadPromptFileAPI(file);
      if (res.data) {
        // The file is only linked to the Assignment once the form is saved.
        void message.success(
          value ? "Đã thay tệp. Hãy lưu bài tập để giữ tệp này." : "Đã đính kèm tệp. Hãy lưu bài tập để giữ tệp này.",
        );
        dropIfFresh(value);
        fresh.current.add(res.data.fileKey);
        onChange(res.data);
      }
      else {
        const text = assessmentErrorText(res, "Không thể tải tệp lên.");
        setError(text);
        void message.error(text);
      }
    } catch {
      setError("Không kết nối được dịch vụ đánh giá. Vui lòng thử lại.");
      void message.error("Không thể tải tệp lên.");
    } finally {
      setBusy(false);
      if (input.current) input.current.value = "";
    }
  };

  return (
    <div>
      <label className="instructor-form-label instructor-form-label-spaced">
        Tệp đính kèm (không bắt buộc, một tệp PDF, DOCX hoặc ZIP, tối đa {formatFileSize(maxBytes)})
      </label>
      <input
        ref={input}
        type="file"
        accept=".pdf,.docx,.zip"
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
                    void message.success("Đã gỡ tệp. Hãy lưu bài tập để áp dụng.");
                  }}
                >
                  Remove
                </InstructorButton>
              </>
            )}
          </>
        ) : (
          <InstructorButton disabled={disabled || busy} onClick={() => input.current?.click()}>
            {busy ? "Đang tải lên..." : "Chọn tệp"}
          </InstructorButton>
        )}
      </div>
      <FieldError message={error} />
    </div>
  );
};

export default PromptFileField;
