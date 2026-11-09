import { Input, Select } from "antd";

import { ENROLLMENT_STATUS_LABELS, ENROLLMENT_TYPE_LABELS } from "@/utils/learner.labels";

export const typeOptions = [
  { value: "", label: "Tất cả loại Khóa học" },
  ...Object.entries(ENROLLMENT_TYPE_LABELS).map(([value, label]) => ({ value, label })),
];

export const statusOptions = [
  { value: "", label: "Tất cả trạng thái" },
  ...Object.entries(ENROLLMENT_STATUS_LABELS)
    .filter(([value]) => value !== "Withdrawn")
    .map(([value, { label }]) => ({ value, label })),
];

interface MyCourseFilterProps {
  draft: string;
  setDraft: (value: string) => void;
  type?: string;
  status?: string;
  updateFilter: (name: "type" | "status", value: string) => void;
}

export const MyCourseFilters = ({
  draft, setDraft, type, status, updateFilter,
}: MyCourseFilterProps) => (
  <div className="learner-my-course-filters">
    <Input
      aria-label="Tìm theo tên Khóa học"
      placeholder="Tìm theo tên Khóa học"
      value={draft}
      maxLength={200}
      onChange={(event) => setDraft(event.target.value)}
      allowClear
    />
    <Select
      aria-label="Loại Khóa học"
      options={typeOptions}
      value={type ?? ""}
      onChange={(value) => updateFilter("type", value)}
    />
    <Select
      aria-label="Trạng thái"
      options={statusOptions}
      value={status ?? ""}
      onChange={(value) => updateFilter("status", value)}
    />
  </div>
);
