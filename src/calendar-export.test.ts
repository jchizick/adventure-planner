import { describe, expect, it } from "vitest";
import {
  CALENDAR_EXPORT_DEFAULT_DURATION_MINUTES,
  CALENDAR_EXPORT_MIME_TYPE,
  buildGoogleCalendarUrl,
  calendarExportFilename,
  createCalendarExportEvent,
  createICalendarBlob,
  generateICalendar,
} from "./calendar-export";
import type { Adventure } from "./types";

function adventure(overrides: Partial<Adventure> = {}): Adventure {
  return {
    id: "adventure-123",
    title: "Ford Music, Lights & Colour Tour 🎵",
    description: "Dinner first; then the concert.\nBring Liz's pass.",
    date: "2026-07-21",
    startTime: "",
    endTime: "",
    status: "Confirmed",
    coverStoragePath: "spaces/private/cover.webp",
    coverUrl: "https://storage.example/signed?token=secret",
    location: "Massey Hall, Toronto",
    savedLocation: { kind: "text", label: "Massey Hall, Toronto" },
    timezone: "America/Toronto",
    stops: [],
    notes: "",
    links: [{ id: "link", label: "Website", url: "https://example.com/show", sortOrder: 1 }],
    checklist: [],
    addedBy: "Planner",
    updatedBy: "Planner",
    updatedAt: "2026-07-20T12:34:56.000Z",
    completed: false,
    favorite: false,
    ...overrides,
    tags: overrides.tags ?? [],
  };
}

describe("Adventure calendar export normalization", () => {
  it("rejects undated, invalid, partial, and reversed ranges", () => {
    expect(createCalendarExportEvent(adventure({ date: "" }))).toBeNull();
    expect(createCalendarExportEvent(adventure({ date: "2026-02-30" }))).toBeNull();
    expect(createCalendarExportEvent(adventure({ endTime: "8:00 PM" }))).toBeNull();
    expect(createCalendarExportEvent(adventure({ endDate: "2026-07-20" }))).toBeNull();
  });

  it("normalizes untimed single- and multi-day Adventures with exclusive ends", () => {
    expect(createCalendarExportEvent(adventure())).toMatchObject({
      isAllDay: true,
      startDate: "2026-07-21",
      endDateExclusive: "2026-07-22",
    });
    expect(createCalendarExportEvent(adventure({ endDate: "2026-07-23" }))).toMatchObject({
      isAllDay: true,
      startDate: "2026-07-21",
      endDateExclusive: "2026-07-24",
    });
  });

  it("converts Toronto timed ranges to UTC and preserves DST offsets", () => {
    const summer = createCalendarExportEvent(adventure({
      startTime: "7:00 PM",
      endTime: "10:00 PM",
    }));
    expect(summer).toMatchObject({ isAllDay: false, timezone: "America/Toronto" });
    if (!summer || summer.isAllDay) throw new Error("Expected timed event");
    expect(summer.startUtc.toISOString()).toBe("2026-07-21T23:00:00.000Z");
    expect(summer.endUtc.toISOString()).toBe("2026-07-22T02:00:00.000Z");

    const winter = createCalendarExportEvent(adventure({
      date: "2026-01-21",
      startTime: "7:00 PM",
      endTime: "8:00 PM",
    }));
    if (!winter || winter.isAllDay) throw new Error("Expected timed event");
    expect(winter.startUtc.toISOString()).toBe("2026-01-22T00:00:00.000Z");
    expect(winter.endUtc.toISOString()).toBe("2026-01-22T01:00:00.000Z");
  });

  it("exports July 26 single-day start and end times as exact UTC instants", () => {
    const event = createCalendarExportEvent(adventure({
      date: "2026-07-26",
      startTime: "2:00 PM",
      endTime: "4:30 PM",
    }));
    if (!event || event.isAllDay) throw new Error("Expected timed event");
    expect(event.startUtc.toISOString()).toBe("2026-07-26T18:00:00.000Z");
    expect(event.endUtc.toISOString()).toBe("2026-07-26T20:30:00.000Z");
  });

  it("handles DST boundaries and rejects a nonexistent local time", () => {
    const beforeSpringForward = createCalendarExportEvent(adventure({
      date: "2026-03-08",
      startTime: "1:30 AM",
      endTime: "3:30 AM",
    }));
    if (!beforeSpringForward || beforeSpringForward.isAllDay)
      throw new Error("Expected timed event");
    expect(beforeSpringForward.startUtc.toISOString()).toBe("2026-03-08T06:30:00.000Z");
    expect(beforeSpringForward.endUtc.toISOString()).toBe("2026-03-08T07:30:00.000Z");
    expect(createCalendarExportEvent(adventure({
      date: "2026-03-08",
      startTime: "2:30 AM",
    }))).toBeNull();
  });

  it("uses a 60-minute default and the app's final-day rule", () => {
    const defaultEnd = createCalendarExportEvent(adventure({ startTime: "7:00 PM" }));
    if (!defaultEnd || defaultEnd.isAllDay) throw new Error("Expected timed event");
    expect((defaultEnd.endUtc.getTime() - defaultEnd.startUtc.getTime()) / 60_000)
      .toBe(CALENDAR_EXPORT_DEFAULT_DURATION_MINUTES);

    const finalDay = createCalendarExportEvent(adventure({
      startTime: "7:00 PM",
      endDate: "2026-07-23",
    }));
    if (!finalDay || finalDay.isAllDay) throw new Error("Expected timed event");
    expect(finalDay.endUtc.toISOString()).toBe("2026-07-24T03:59:59.000Z");
  });

  it("uses exact start and end values for a timed multi-day Adventure", () => {
    const event = createCalendarExportEvent(adventure({
      startTime: "4:00 PM",
      endDate: "2026-07-23",
      endTime: "11:00 AM",
    }));
    if (!event || event.isAllDay) throw new Error("Expected timed event");
    expect(event.startUtc.toISOString()).toBe("2026-07-21T20:00:00.000Z");
    expect(event.endUtc.toISOString()).toBe("2026-07-23T15:00:00.000Z");
  });

  it("includes only safe descriptive fields and uses the application timezone fallback", () => {
    const event = createCalendarExportEvent(adventure({ timezone: undefined }), "America/Vancouver");
    expect(event).toMatchObject({
      title: "Ford Music, Lights & Colour Tour 🎵",
      location: "Massey Hall, Toronto",
      sourceUrl: "https://ouradventures.today/adventures/adventure-123",
      websiteUrl: "https://example.com/show",
      timezone: "America/Vancouver",
    });
    expect(event?.description).toContain("Adventure details:\nhttps://ouradventures.today/adventures/adventure-123");
    expect(event?.description).toContain("Website:\nhttps://example.com/show");
    expect(event?.description).not.toContain("signed");
    expect(event?.description).not.toContain("spaces/private");
  });
});

describe("Google Calendar template URL", () => {
  it("uses Google's documented template and encodes all-day and text fields", () => {
    const event = createCalendarExportEvent(adventure({ endDate: "2026-07-23" }));
    if (!event) throw new Error("Expected event");
    const url = new URL(buildGoogleCalendarUrl(event));
    expect(url.origin + url.pathname).toBe("https://calendar.google.com/calendar/r/eventedit");
    expect(url.searchParams.get("action")).toBe("TEMPLATE");
    expect(url.searchParams.get("text")).toBe("Ford Music, Lights & Colour Tour 🎵");
    expect(url.searchParams.get("dates")).toBe("20260721/20260724");
    expect(url.searchParams.get("details")).toContain("Dinner first; then the concert.\n");
    expect(url.searchParams.get("location")).toBe("Massey Hall, Toronto");
  });

  it("uses UTC timestamps plus the IANA start and end timezone for timed events", () => {
    const event = createCalendarExportEvent(adventure({
      description: "Path C:\\tickets, desk; row\nNext line",
      startTime: "7:00 PM",
      endTime: "10:00 PM",
    }));
    if (!event) throw new Error("Expected event");
    const params = new URL(buildGoogleCalendarUrl(event)).searchParams;
    expect(params.get("dates")).toBe("20260721T230000Z/20260722T020000Z");
    expect(params.get("stz")).toBe("America/Toronto");
    expect(params.get("etz")).toBe("America/Toronto");
  });
});

describe("RFC 5545 iCalendar output", () => {
  it("emits stable metadata, UTC timed values, escaping, and CRLF", () => {
    const event = createCalendarExportEvent(adventure({
      description: "Path C:\\tickets, desk; row\nNext line",
      startTime: "7:00 PM",
      endTime: "10:00 PM",
    }));
    if (!event) throw new Error("Expected event");
    const ics = generateICalendar(event, new Date("2026-07-20T14:00:00.000Z"));
    expect(ics).toContain("BEGIN:VCALENDAR\r\nVERSION:2.0\r\n");
    expect(ics).toContain("BEGIN:VEVENT\r\n");
    expect(ics).toContain("UID:adventure-adventure-123@ouradventures.today\r\n");
    expect(ics).toContain("DTSTAMP:20260720T140000Z\r\n");
    expect(ics).toContain("LAST-MODIFIED:20260720T123456Z\r\n");
    expect(ics).toContain("DTSTART:20260721T230000Z\r\nDTEND:20260722T020000Z\r\n");
    expect(ics).toContain("Path C:\\\\tickets\\, desk\\; row\\nNext line");
    expect(ics).toContain("SUMMARY:Ford Music\\, Lights & Colour Tour 🎵");
    expect(ics).toContain("LOCATION:Massey Hall\\, Toronto\r\n");
    expect(ics).toContain("URL:https://ouradventures.today/adventures/adventure-123\r\n");
    expect(ics).toContain("STATUS:CONFIRMED\r\nEND:VEVENT\r\nEND:VCALENDAR\r\n");
    expect(ics.replaceAll("\r\n", "")).not.toContain("\n");
    expect(ics).not.toContain("spaces/private");
    expect(ics).not.toContain("token=secret");
  });

  it("emits all-day values with an exclusive end", () => {
    const event = createCalendarExportEvent(adventure({ endDate: "2026-07-23" }));
    if (!event) throw new Error("Expected event");
    const ics = generateICalendar(event, new Date("2026-07-20T14:00:00.000Z"));
    expect(ics).toContain("DTSTART;VALUE=DATE:20260721\r\n");
    expect(ics).toContain("DTEND;VALUE=DATE:20260724\r\n");
  });

  it("folds Unicode content at 75 UTF-8 octets without changing it", () => {
    const title = `Café 🎵 ${"é".repeat(50)} end`;
    const event = createCalendarExportEvent(adventure({ title }));
    if (!event) throw new Error("Expected event");
    const ics = generateICalendar(event, new Date("2026-07-20T14:00:00.000Z"));
    const encoder = new TextEncoder();
    for (const line of ics.split("\r\n").filter(Boolean)) {
      expect(encoder.encode(line).length).toBeLessThanOrEqual(75);
    }
    const unfolded = ics.replaceAll("\r\n ", "");
    expect(unfolded).toContain(`SUMMARY:${title}`);
  });

  it("creates a calendar MIME Blob and safe filename", () => {
    const event = createCalendarExportEvent(adventure());
    if (!event) throw new Error("Expected event");
    expect(createICalendarBlob(event, new Date("2026-07-20T14:00:00.000Z")).type)
      .toBe(CALENDAR_EXPORT_MIME_TYPE);
    expect(calendarExportFilename(event.title)).toBe("ford-music-lights-colour-tour.ics");
    expect(calendarExportFilename("🎵 / \\ : * ?")).toBe("adventure.ics");
  });
});
