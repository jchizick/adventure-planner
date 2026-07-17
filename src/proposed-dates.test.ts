import { describe, expect, it } from "vitest";
import {
  expandCalendarEventRanges,
  formatAdventureDateTimeRange,
  formatAdventureCountdown,
  isAdventureMemoryEligible,
  validateDateTimeRange,
} from "./calendar";
import { duplicateIdeaForEditing } from "./idea-model";
import type { CalendarEvent, Idea } from "./types";

describe("proposed dates and multi-day Adventures", () => {
  it("formats untimed, same-day, multi-day, and cross-year ranges", () => {
    expect(formatAdventureDateTimeRange({ startDate: "2026-07-21" })).toBe("Tue, Jul 21");
    expect(formatAdventureDateTimeRange({ startDate: "2026-07-21", startTime: "19:00" })).toBe("Tue, Jul 21 · 7:00 PM");
    expect(formatAdventureDateTimeRange({ startDate: "2026-07-21", startTime: "19:00", endTime: "22:00" })).toBe("Tue, Jul 21 · 7:00 PM – 10:00 PM");
    expect(formatAdventureDateTimeRange({ startDate: "2026-08-14", endDate: "2026-08-16" })).toBe("Fri, Aug 14 – Sun, Aug 16");
    expect(formatAdventureDateTimeRange({ startDate: "2026-08-14", startTime: "16:00", endDate: "2026-08-16", endTime: "11:00" })).toBe("Fri, Aug 14 at 4:00 PM – Sun, Aug 16 at 11:00 AM");
    expect(formatAdventureDateTimeRange({ startDate: "2026-12-31", endDate: "2027-01-02" })).toBe("Dec 31, 2026 – Jan 2, 2027");
  });

  it("enforces dependent and ordered optional proposal values", () => {
    expect(validateDateTimeRange({ endTime: "12:00", requireStartDate: false })).toMatchObject({ startDate: expect.any(String), endDate: expect.any(String) });
    expect(validateDateTimeRange({ startDate: "2026-08-16", endDate: "2026-08-14" })).toHaveProperty("endDate");
    expect(validateDateTimeRange({ startDate: "2026-08-14", endDate: "2026-08-14", startTime: "18:00", endTime: "17:00" })).toHaveProperty("endTime");
  });

  it("expands proposals across every calendar day", () => {
    const event: CalendarEvent = { id: "proposal", title: "Cabin", subtitle: "Proposed idea", date: "2026-08-14", endDate: "2026-08-16", category: "trips-getaways", status: "Idea", kind: "proposal" };
    expect(expandCalendarEventRanges([event]).map((item) => item.date)).toEqual(["2026-08-14", "2026-08-15", "2026-08-16"]);
  });

  it("keeps a multi-day Adventure active until its effective end", () => {
    expect(formatAdventureCountdown("2026-08-14", "16:00", "11:00", new Date(2026, 7, 15, 9), "2026-08-16").state).toBe("happening");
    expect(formatAdventureCountdown("2026-08-14", "", undefined, new Date(2026, 7, 15, 9), "2026-08-16").state).toBe("happening");
    expect(isAdventureMemoryEligible({ date: "2026-08-14", endDate: "2026-08-16", endTime: "11:00 AM" }, new Date(2026, 7, 16, 10))).toBe(false);
    expect(isAdventureMemoryEligible({ date: "2026-08-14", endDate: "2026-08-16", endTime: "11:00 AM" }, new Date(2026, 7, 16, 12))).toBe(true);
  });

  it("clears proposal values when duplicating an Idea", () => {
    const idea = { id: "idea", title: "Cabin", description: "", category: "trips-getaways", status: "Tentative", tags: [], addedBy: "Planner", isDateNight: false, createdAt: "now", proposedStartDate: "2026-08-14", proposedEndDate: "2026-08-16" } satisfies Idea;
    expect(duplicateIdeaForEditing(idea, [])).toMatchObject({ proposedStartDate: undefined, proposedEndDate: undefined });
  });
});
