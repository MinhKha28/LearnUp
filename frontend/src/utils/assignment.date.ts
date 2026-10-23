import { formatDueAt } from "@/utils/due.format";

const partsFor = (value: string | null, timezone: string | null) => {
  if (!value || Number.isNaN(new Date(value).getTime())) return null;
  const options: Intl.DateTimeFormatOptions = {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  };
  let formatter: Intl.DateTimeFormat;
  try {
    formatter = new Intl.DateTimeFormat("en-GB", { ...options, timeZone: timezone ?? undefined });
  } catch {
    formatter = new Intl.DateTimeFormat("en-GB", options);
  }
  return Object.fromEntries(formatter.formatToParts(new Date(value)).map(part => [part.type, part.value]));
};

export const assignmentDateOnly = (value: string | null, timezone: string | null): string => {
  const parts = partsFor(value, timezone);
  return parts ? `${parts.day}/${parts.month}/${parts.year}` : "—";
};

export const assignmentTimestamp = (value: string | null, timezone: string | null): string => {
  const parts = partsFor(value, timezone);
  return parts ? `${parts.day}/${parts.month}/${parts.year} ${parts.hour}:${parts.minute}` : "—";
};

// Reuse the shared midnight boundary without changing the learner's deadline wording.
export const assignmentDueDate = (value: string | null, timezone: string | null): string =>
  value ? (formatDueAt(value, timezone).text.match(/\d{2}\/\d{2}\/\d{4}/)?.[0] ?? "—") : "—";

export const assignmentDueNote = (timezone: string | null): string => {
  if (timezone) {
    try {
      new Intl.DateTimeFormat("vi-VN", { timeZone: timezone });
      return `Tính đến hết ngày theo giờ tổ chức (${timezone})`;
    } catch { /* An unavailable timezone uses the same device-time fallback as formatDueAt. */ }
  }
  return "Tính đến hết ngày theo giờ trên máy bạn (chưa có múi giờ tổ chức)";
};
