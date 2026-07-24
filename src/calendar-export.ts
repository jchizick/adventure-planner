import type { Adventure } from "./types";
import { adventureEffectiveEndDate } from "./calendar";

export const CALENDAR_EXPORT_DEFAULT_DURATION_MINUTES = 60;
export const CALENDAR_EXPORT_MIME_TYPE = "text/calendar;charset=utf-8";
export const OUR_ADVENTURES_ORIGIN = "https://ouradventures.today";

const GOOGLE_CALENDAR_TEMPLATE_URL =
  "https://calendar.google.com/calendar/r/eventedit";
const LOCATION_TBD = "Location to be decided";

type CalendarExportCommon = {
  uid: string;
  title: string;
  description: string;
  location?: string;
  sourceUrl: string;
  websiteUrl?: string;
  timezone: string;
  lastModified?: Date;
};

export type CalendarExportEvent = CalendarExportCommon &
  (
    | {
        isAllDay: true;
        startDate: string;
        endDateExclusive: string;
      }
    | {
        isAllDay: false;
        startUtc: Date;
        endUtc: Date;
      }
  );

type ClockTime = { hours: number; minutes: number; seconds: number };

function parseCalendarDate(value?: string) {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ? { year, month, day }
    : null;
}

function parseClockTime(value?: string): ClockTime | null {
  const trimmed = value?.trim();
  if (!trimmed) return null;
  const twelveHour = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?\s*(AM|PM)$/i);
  if (twelveHour) {
    const hour = Number(twelveHour[1]);
    const minutes = Number(twelveHour[2]);
    const seconds = Number(twelveHour[3] ?? 0);
    if (hour < 1 || hour > 12 || minutes > 59 || seconds > 59) return null;
    return {
      hours: (hour % 12) + (twelveHour[4].toUpperCase() === "PM" ? 12 : 0),
      minutes,
      seconds,
    };
  }
  const twentyFourHour = trimmed.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!twentyFourHour) return null;
  const hours = Number(twentyFourHour[1]);
  const minutes = Number(twentyFourHour[2]);
  const seconds = Number(twentyFourHour[3] ?? 0);
  return hours <= 23 && minutes <= 59 && seconds <= 59
    ? { hours, minutes, seconds }
    : null;
}

function isValidTimeZone(timezone: string) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format();
    return true;
  } catch {
    return false;
  }
}

export function applicationTimeZone() {
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return timezone && isValidTimeZone(timezone) ? timezone : "";
}

function partsInTimeZone(date: Date, timezone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: timezone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
  const values = Object.fromEntries(
    parts.filter(({ type }) => type !== "literal").map(({ type, value }) => [type, Number(value)]),
  );
  return {
    year: values.year,
    month: values.month,
    day: values.day,
    hours: values.hour,
    minutes: values.minute,
    seconds: values.second,
  };
}

function zonedDateTimeToUtc(
  dateValue: string,
  clock: ClockTime,
  timezone: string,
) {
  const date = parseCalendarDate(dateValue);
  if (!date || !isValidTimeZone(timezone)) return null;
  const desiredUtc = Date.UTC(
    date.year,
    date.month - 1,
    date.day,
    clock.hours,
    clock.minutes,
    clock.seconds,
  );
  let candidate = new Date(desiredUtc);
  for (let attempt = 0; attempt < 3; attempt += 1) {
    const actual = partsInTimeZone(candidate, timezone);
    const representedUtc = Date.UTC(
      actual.year,
      actual.month - 1,
      actual.day,
      actual.hours,
      actual.minutes,
      actual.seconds,
    );
    candidate = new Date(candidate.getTime() + desiredUtc - representedUtc);
  }
  const roundTrip = partsInTimeZone(candidate, timezone);
  return roundTrip.year === date.year &&
      roundTrip.month === date.month &&
      roundTrip.day === date.day &&
      roundTrip.hours === clock.hours &&
      roundTrip.minutes === clock.minutes &&
      roundTrip.seconds === clock.seconds
    ? candidate
    : null;
}

function addCalendarDays(value: string, amount: number) {
  const date = parseCalendarDate(value);
  if (!date) return null;
  const next = new Date(Date.UTC(date.year, date.month - 1, date.day + amount));
  return [
    next.getUTCFullYear(),
    String(next.getUTCMonth() + 1).padStart(2, "0"),
    String(next.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function safeWebsiteUrl(adventure: Pick<Adventure, "links">) {
  const website = adventure.links.find(
    ({ label }) => label.trim().toLowerCase() === "website",
  )?.url;
  if (!website) return undefined;
  try {
    const url = new URL(website);
    return url.protocol === "http:" || url.protocol === "https:"
      ? url.toString()
      : undefined;
  } catch {
    return undefined;
  }
}

function buildDescription(adventureDescription: string, sourceUrl: string, websiteUrl?: string) {
  return [
    adventureDescription.trim(),
    `Adventure details:\n${sourceUrl}`,
    websiteUrl ? `Website:\n${websiteUrl}` : "",
  ].filter(Boolean).join("\n\n");
}

function stableUid(id: string) {
  return `adventure-${encodeURIComponent(id)}@ouradventures.today`;
}

export function createCalendarExportEvent(
  adventure: Pick<
    Adventure,
    | "id"
    | "title"
    | "description"
    | "date"
    | "endDate"
    | "startTime"
    | "endTime"
    | "location"
    | "timezone"
    | "links"
    | "updatedAt"
  >,
  fallbackTimezone = applicationTimeZone(),
): CalendarExportEvent | null {
  const title = adventure.title.trim();
  const startDate = parseCalendarDate(adventure.date);
  const endDateValue = adventureEffectiveEndDate(adventure);
  const endDate = parseCalendarDate(endDateValue);
  if (!adventure.id || /[\r\n]/.test(adventure.id) || !title || !startDate || !endDate || endDateValue < adventure.date)
    return null;

  const timezone = adventure.timezone?.trim() || fallbackTimezone;
  if (!isValidTimeZone(timezone)) return null;
  const startClock = parseClockTime(adventure.startTime);
  const endClock = parseClockTime(adventure.endTime);
  const hasStartTime = Boolean(adventure.startTime.trim());
  const hasEndTime = Boolean(adventure.endTime.trim());
  if (hasStartTime !== Boolean(startClock) || hasEndTime !== Boolean(endClock) || (!startClock && endClock))
    return null;

  const sourceUrl = new URL(`/adventures/${encodeURIComponent(adventure.id)}`, OUR_ADVENTURES_ORIGIN).toString();
  const websiteUrl = safeWebsiteUrl(adventure);
  const modified = adventure.updatedAt ? new Date(adventure.updatedAt) : null;
  const common: CalendarExportCommon = {
    uid: stableUid(adventure.id),
    title,
    description: buildDescription(adventure.description, sourceUrl, websiteUrl),
    ...(adventure.location.trim() && adventure.location.trim() !== LOCATION_TBD
      ? { location: adventure.location.trim() }
      : {}),
    sourceUrl,
    ...(websiteUrl ? { websiteUrl } : {}),
    timezone,
    ...(modified && !Number.isNaN(modified.getTime()) ? { lastModified: modified } : {}),
  };

  if (!startClock) {
    const endDateExclusive = addCalendarDays(endDateValue, 1);
    return endDateExclusive
      ? { ...common, isAllDay: true, startDate: adventure.date, endDateExclusive }
      : null;
  }

  const startUtc = zonedDateTimeToUtc(adventure.date, startClock, timezone);
  if (!startUtc) return null;
  let endUtc: Date | null;
  if (endClock) {
    endUtc = zonedDateTimeToUtc(endDateValue, endClock, timezone);
  } else if (adventure.endDate) {
    // Matches the app's effective-end rule: a final date without a time lasts
    // through 23:59:59 in the Adventure timezone.
    endUtc = zonedDateTimeToUtc(
      endDateValue,
      { hours: 23, minutes: 59, seconds: 59 },
      timezone,
    );
  } else {
    endUtc = new Date(
      startUtc.getTime() + CALENDAR_EXPORT_DEFAULT_DURATION_MINUTES * 60_000,
    );
  }
  return endUtc && endUtc > startUtc
    ? { ...common, isAllDay: false, startUtc, endUtc }
    : null;
}

function compactDate(value: string) {
  return value.replaceAll("-", "");
}

function utcTimestamp(value: Date) {
  return value.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

export function buildGoogleCalendarUrl(event: CalendarExportEvent) {
  const url = new URL(GOOGLE_CALENDAR_TEMPLATE_URL);
  url.searchParams.set("action", "TEMPLATE");
  url.searchParams.set("text", event.title);
  url.searchParams.set(
    "dates",
    event.isAllDay
      ? `${compactDate(event.startDate)}/${compactDate(event.endDateExclusive)}`
      : `${utcTimestamp(event.startUtc)}/${utcTimestamp(event.endUtc)}`,
  );
  url.searchParams.set("details", event.description);
  if (event.location) url.searchParams.set("location", event.location);
  if (!event.isAllDay) {
    url.searchParams.set("stz", event.timezone);
    url.searchParams.set("etz", event.timezone);
  }
  return url.toString();
}

function escapeICalendarText(value: string) {
  return value
    .replaceAll("\\", "\\\\")
    .replace(/\r\n|\r|\n/g, "\\n")
    .replaceAll(",", "\\,")
    .replaceAll(";", "\\;");
}

export function foldICalendarLine(line: string) {
  const encoder = new TextEncoder();
  const folded: string[] = [];
  let current = "";
  let limit = 75;
  for (const character of line) {
    if (encoder.encode(current + character).length > limit && current) {
      folded.push(current);
      current = character;
      limit = 74;
    } else {
      current += character;
    }
  }
  folded.push(current);
  return folded.join("\r\n ");
}

export function generateICalendar(
  event: CalendarExportEvent,
  exportedAt = new Date(),
) {
  if (Number.isNaN(exportedAt.getTime())) throw new Error("Invalid export timestamp.");
  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Our Adventures//Adventure Planner//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VEVENT",
    `UID:${escapeICalendarText(event.uid)}`,
    `DTSTAMP:${utcTimestamp(exportedAt)}`,
    ...(event.lastModified ? [`LAST-MODIFIED:${utcTimestamp(event.lastModified)}`] : []),
    ...(event.isAllDay
      ? [
          `DTSTART;VALUE=DATE:${compactDate(event.startDate)}`,
          `DTEND;VALUE=DATE:${compactDate(event.endDateExclusive)}`,
        ]
      : [
          `DTSTART:${utcTimestamp(event.startUtc)}`,
          `DTEND:${utcTimestamp(event.endUtc)}`,
        ]),
    `SUMMARY:${escapeICalendarText(event.title)}`,
    `DESCRIPTION:${escapeICalendarText(event.description)}`,
    ...(event.location ? [`LOCATION:${escapeICalendarText(event.location)}`] : []),
    `URL:${event.sourceUrl}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
    "END:VCALENDAR",
  ];
  return `${lines.map(foldICalendarLine).join("\r\n")}\r\n`;
}

export function calendarExportFilename(title: string) {
  const safe = title
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
  return `${safe || "adventure"}.ics`;
}

export function createICalendarBlob(event: CalendarExportEvent, exportedAt = new Date()) {
  return new Blob([generateICalendar(event, exportedAt)], {
    type: CALENDAR_EXPORT_MIME_TYPE,
  });
}

export function downloadICalendar(event: CalendarExportEvent) {
  const objectUrl = URL.createObjectURL(createICalendarBlob(event));
  try {
    const anchor = document.createElement("a");
    anchor.href = objectUrl;
    anchor.download = calendarExportFilename(event.title);
    anchor.click();
  } finally {
    setTimeout(() => URL.revokeObjectURL(objectUrl), 0);
  }
}
