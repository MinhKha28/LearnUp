import { Button, Input, Select } from "antd";
import viVN from "antd/es/date-picker/locale/vi_VN";
import dayjs from "dayjs";
import "dayjs/locale/vi";
import customParseFormat from "dayjs/plugin/customParseFormat";
import { useState } from "react";
import type { AssignmentFilters, AssignmentStatus } from "@/types/assignment.types";
import { assignmentStatus } from "@/utils/assignments.view";
import "./assignment.filters.scss";
import { VietnameseRangePicker } from "@/components/vietnamese.controls";

dayjs.extend(customParseFormat);
const apiDate = "YYYY-MM-DD";
const parseDate = (value?: string) => {
  const date = dayjs(value, apiDate, true);
  return value && date.isValid() ? date : null;
};

export const AssignmentFilterBar = ({
  filters,
  apply,
  clear,
}: {
  filters: AssignmentFilters;
  apply: (filters: AssignmentFilters) => void;
  clear: () => void;
}) => {
  const [draft, setDraft] = useState(filters);

  return (
    <form
      className="organizer-assignment-filters"
      aria-label="Bộ lọc phân công"
      onSubmit={(event) => {
        event.preventDefault();
        apply({
          ...draft,
          learner: draft.learner?.normalize("NFC").trim(),
          course: draft.course?.normalize("NFC").trim(),
        });
      }}
    >
      <div className="organizer-assignment-keywords">
        <div className="organizer-assignment-keyword-fields">
          <div className="organizer-assignment-filter-field">
            <label htmlFor="assignment-learner">Học viên</label>
            <Input
              id="assignment-learner"
              aria-describedby="assignment-keyword-hint"
              value={draft.learner ?? ""}
              maxLength={100}
              onChange={(event) => setDraft({ ...draft, learner: event.target.value })}
            />
          </div>
          <div className="organizer-assignment-filter-field">
            <label htmlFor="assignment-course">Khóa học</label>
            <Input
              id="assignment-course"
              aria-describedby="assignment-keyword-hint"
              value={draft.course ?? ""}
              maxLength={100}
              onChange={(event) => setDraft({ ...draft, course: event.target.value })}
            />
          </div>
        </div>
        <small id="assignment-keyword-hint">Nhập đúng dấu tiếng Việt, ví dụ: Hào</small>
      </div>
      <div className="organizer-assignment-filter-field">
        <label htmlFor="assignment-status">Trạng thái</label>
        <Select<AssignmentStatus>
          id="assignment-status"
          placeholder="Tất cả"
          allowClear
          value={draft.status}
          options={Object.entries(assignmentStatus).map(([value, { label }]) => ({ value, label }))}
          onChange={(status) => setDraft({ ...draft, status })}
        />
      </div>
      <div className="organizer-assignment-filter-field" role="group" aria-labelledby="assignment-date-label">
        <span id="assignment-date-label">Hạn hoàn thành</span>
        <VietnameseRangePicker
          locale={viVN}
          format="DD/MM/YYYY"
          placeholder={["Từ ngày", "Đến ngày"]}
          allowEmpty={[true, true]}
          popupClassName="organizer-assignment-date-popup"
          value={[parseDate(draft.dueFrom), parseDate(draft.dueTo)]}
          onChange={(dates) => setDraft({
            ...draft,
            dueFrom: dates?.[0]?.format(apiDate),
            dueTo: dates?.[1]?.format(apiDate),
          })}
        />
      </div>
      <div className="organizer-assignment-filter-actions">
        <Button type="primary" htmlType="submit">Tìm</Button>
        <Button onClick={() => { setDraft({}); clear(); }}>Xóa bộ lọc</Button>
      </div>
    </form>
  );
};
