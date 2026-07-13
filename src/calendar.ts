import type { CalendarEvent } from "./types";

export const toLocalDateKey = (date: Date) => {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export const parseLocalDate = (key: string) => {
  const [year, month, day] = key.split("-").map(Number);
  return new Date(year, month - 1, day);
};

export type AdventureCountdown = {
  label: string;
  accessibleLabel: string;
  state: "upcoming" | "happening" | "past" | "invalid";
};

const parseClockTime = (value: string) => {
  const twelveHour = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHour) {
    const twelveHourValue = Number(twelveHour[1]);
    if (twelveHourValue < 1 || twelveHourValue > 12) return null;
    let hours = twelveHourValue % 12;
    if (twelveHour[3].toUpperCase() === "PM") hours += 12;
    const minutes = Number(twelveHour[2]);
    return hours <= 23 && minutes <= 59 ? { hours, minutes } : null;
  }
  const twentyFourHour = value.match(/^(\d{1,2}):(\d{2})(?::\d{2})?$/);
  if (!twentyFourHour) return null;
  const hours = Number(twentyFourHour[1]);
  const minutes = Number(twentyFourHour[2]);
  return hours <= 23 && minutes <= 59 ? { hours, minutes } : null;
};

const formatClockTime = (value: string | undefined) => {
  if (!value) return null;
  const clock = parseClockTime(value.trim());
  if (!clock) return null;
  const suffix = clock.hours >= 12 ? "PM" : "AM";
  return `${clock.hours % 12 || 12}:${String(clock.minutes).padStart(2, "0")} ${suffix}`;
};

const validLocalDate = (key: string | undefined) => {
  if (!key || !/^\d{4}-\d{2}-\d{2}$/.test(key)) return null;
  const [year, month, day] = key.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  return date.getFullYear() === year &&
    date.getMonth() === month - 1 &&
    date.getDate() === day
    ? date
    : null;
};

export type AdventureDateTimeRangeInput = {
  startDate?: string;
  startTime?: string;
  endDate?: string;
  endTime?: string;
  allDay?: boolean;
};

export const formatAdventureDateTimeRange = ({
  startDate,
  startTime,
  endDate,
  endTime,
  allDay = false,
}: AdventureDateTimeRangeInput) => {
  if (allDay) return "All day";

  const start = formatClockTime(startTime);
  const end = formatClockTime(endTime);
  if (!start && !end) return "Time to be confirmed";

  const parsedStartDate = validLocalDate(startDate);
  const parsedEndDate = validLocalDate(endDate);
  const isMultiDay =
    parsedStartDate &&
    parsedEndDate &&
    toLocalDateKey(parsedStartDate) !== toLocalDateKey(parsedEndDate);

  if (isMultiDay) {
    const crossesYears =
      parsedStartDate.getFullYear() !== parsedEndDate.getFullYear();
    const dateFormatter = new Intl.DateTimeFormat("en-CA", {
      month: "short",
      day: "numeric",
      ...(crossesYears ? { year: "numeric" } : {}),
    });
    const startLabel = start
      ? `${dateFormatter.format(parsedStartDate)}, ${start}`
      : null;
    const endLabel = end
      ? `${dateFormatter.format(parsedEndDate)}, ${end}`
      : null;
    if (startLabel && endLabel) return `${startLabel} – ${endLabel}`;
    if (startLabel) return startLabel;
    if (endLabel) return `Until ${endLabel}`;
  }

  if (start && end) return `${start} – ${end}`;
  if (start) return start;
  return `Until ${end}`;
};

const parseAdventureDateTime = (date: string, time: string) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const [year, month, day] = date.split("-").map(Number);
  const clock = parseClockTime(time);
  if (!clock) return null;
  const result = new Date(year, month - 1, day, clock.hours, clock.minutes);
  if (
    result.getFullYear() !== year ||
    result.getMonth() !== month - 1 ||
    result.getDate() !== day
  ) return null;
  return result;
};

const joinAccessibleParts = (parts: string[]) => {
  if (parts.length < 2) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;
  return `${parts.slice(0, -1).join(", ")}, and ${parts.at(-1)}`;
};

export const formatAdventureCountdown = (
  date: string,
  startTime: string,
  endTime: string | undefined,
  now: Date,
): AdventureCountdown => {
  const start = parseAdventureDateTime(date, startTime);
  if (!start || Number.isNaN(now.getTime())) {
    return {
      label: "Time to be confirmed",
      accessibleLabel: "Next adventure start time is unavailable",
      state: "invalid",
    };
  }

  const end = endTime ? parseAdventureDateTime(date, endTime) : null;
  if (now >= start) {
    if (end && end > start && now < end) {
      return {
        label: "Happening now",
        accessibleLabel: "Next adventure is happening now",
        state: "happening",
      };
    }
    return {
      label: "Started",
      accessibleLabel: "Next adventure has started",
      state: "past",
    };
  }

  const remainingMs = Math.max(0, start.getTime() - now.getTime());
  if (remainingMs < 60_000) {
    return {
      label: "Starting now",
      accessibleLabel: "Next adventure is starting now",
      state: "upcoming",
    };
  }

  const totalMinutes = Math.ceil(remainingMs / 60_000);
  const days = Math.floor(totalMinutes / 1_440);
  const hours = Math.floor((totalMinutes % 1_440) / 60);
  const minutes = totalMinutes % 60;
  const visualParts = [
    days ? `${days} ${days === 1 ? "Day" : "Days"}` : "",
    hours ? `${hours} hr` : "",
    minutes ? `${minutes} min` : "",
  ].filter(Boolean);
  const accessibleParts = [
    days ? `${days} ${days === 1 ? "day" : "days"}` : "",
    hours ? `${hours} ${hours === 1 ? "hour" : "hours"}` : "",
    minutes ? `${minutes} ${minutes === 1 ? "minute" : "minutes"}` : "",
  ].filter(Boolean);

  return {
    label: visualParts.join(" · "),
    accessibleLabel: `Next adventure starts in ${joinAccessibleParts(accessibleParts)}`,
    state: "upcoming",
  };
};

export const addLocalDays = (key: string, amount: number) => {
  const date = parseLocalDate(key);
  date.setDate(date.getDate() + amount);
  return toLocalDateKey(date);
};

export const addMonths = (month: Date, amount: number) =>
  new Date(month.getFullYear(), month.getMonth() + amount, 1);

export const monthForDate = (key: string) => {
  const date = parseLocalDate(key);
  return new Date(date.getFullYear(), date.getMonth(), 1);
};

export type CalendarDay = {
  key: string;
  date: Date;
  inCurrentMonth: boolean;
};

export const buildMonthGrid = (month: Date): CalendarDay[] => {
  const first = new Date(month.getFullYear(), month.getMonth(), 1);
  const gridStart = new Date(first);
  gridStart.setDate(first.getDate() - first.getDay());
  return Array.from({ length: 42 }, (_, index) => {
    const date = new Date(gridStart);
    date.setDate(gridStart.getDate() + index);
    return {
      key: toLocalDateKey(date),
      date,
      inCurrentMonth: date.getMonth() === month.getMonth(),
    };
  });
};

const minutesFromTime = (value?: string) => {
  if (!value) return Number.MAX_SAFE_INTEGER;
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return Number.MAX_SAFE_INTEGER;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hours += 12;
  return hours * 60 + Number(match[2]);
};

export const sortCalendarEvents = (events: CalendarEvent[]) =>
  [...events].sort((a, b) => {
    if (a.allDay !== b.allDay) return a.allDay ? -1 : 1;
    return minutesFromTime(a.startTime) - minutesFromTime(b.startTime);
  });
