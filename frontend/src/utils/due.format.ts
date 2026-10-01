interface LocalParts {
  day: string;
  month: string;
  year: string;
  hour: string;
  minute: string;
}

const createFormatter = (timeZone?: string) =>
  new Intl.DateTimeFormat("en-GB", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  });

const toParts = (formatter: Intl.DateTimeFormat, date: Date): LocalParts => {
  const parts = Object.fromEntries(formatter.formatToParts(date).map((part) => [part.type, part.value]));
  return { day: parts.day, month: parts.month, year: parts.year, hour: parts.hour, minute: parts.minute };
};

const formatDate = ({ day, month, year }: LocalParts) => `${day}/${month}/${year}`;

const formatTimeDate = (parts: LocalParts) => `${parts.hour}:${parts.minute} ${formatDate(parts)}`;

/** Độ lệch múi giờ theo phút về dạng "GMT+7", "GMT-5", "GMT+5:30", "GMT+0". */
export const formatGmtOffset = (offsetMinutes: number): string => {
  const sign = offsetMinutes < 0 ? "-" : "+";
  const abs = Math.abs(offsetMinutes);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `GMT${sign}${hours}${minutes ? `:${String(minutes).padStart(2, "0")}` : ""}`;
};

const tryCreateFormatter = (timeZone: string | null): Intl.DateTimeFormat | null => {
  if (!timeZone) return null;
  try {
    return createFormatter(timeZone);
  } catch (error) {
    if (error instanceof RangeError) return null;
    throw error;
  }
};

/**
 * Hạn hoàn thành theo múi giờ Organization (D24, D44). Đúng 00:00 địa phương là hết ngày hôm trước,
 * nên lấy ngày của (dueAt − 1 ms). Múi giờ null hoặc không hợp lệ thì hiện theo giờ máy.
 */
export const formatDueAt = (dueAtIso: string, timezone: string | null): { text: string; isDeviceTime: boolean } => {
  const dueAt = new Date(dueAtIso);
  if (Number.isNaN(dueAt.getTime())) {
    return { text: "—", isDeviceTime: false };
  }

  const formatter = tryCreateFormatter(timezone);
  if (formatter) {
    const parts = toParts(formatter, dueAt);
    if (parts.hour === "00" && parts.minute === "00") {
      return { text: `Hết ngày ${formatDate(toParts(formatter, new Date(dueAt.getTime() - 1)))}`, isDeviceTime: false };
    }
    return { text: formatTimeDate(parts), isDeviceTime: false };
  }

  const offset = formatGmtOffset(-dueAt.getTimezoneOffset());
  return {
    text: `${formatTimeDate(toParts(createFormatter(), dueAt))} (giờ trên máy bạn, ${offset})`,
    isDeviceTime: true,
  };
};
