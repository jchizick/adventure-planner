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
