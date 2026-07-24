import { describe, expect, it } from "vitest";
import {
  buildAdventureDayOptions,
  groupStopsByDay,
  insertStopChronologically,
  reconcileStopDaysForAdventureRange,
} from "./itinerary";
import type { AdventureStop } from "./types";

const stop = (
  id: string,
  dayDate: string,
  startTime = "",
  sortOrder = 1,
): AdventureStop => ({
  id,
  title: id,
  dayDate,
  location: "",
  savedLocation: { kind: "none", label: "" },
  startTime,
  sortOrder,
});

describe("multi-day itinerary assignment", () => {
  it("builds inclusive semantic day options across a month boundary", () => {
    expect(buildAdventureDayOptions("2026-07-31", "2026-08-02")).toEqual([
      expect.objectContaining({
        value: "2026-07-31",
        dayNumber: 1,
        label: "Day 1 — Fri, Jul 31",
      }),
      expect.objectContaining({
        value: "2026-08-01",
        dayNumber: 2,
        label: "Day 2 — Sat, Aug 1",
      }),
      expect.objectContaining({
        value: "2026-08-02",
        dayNumber: 3,
        label: "Day 3 — Sun, Aug 2",
      }),
    ]);
  });

  it("groups stops by day while preserving the saved order within each day", () => {
    const groups = groupStopsByDay([
      stop("day-two-untimed", "2026-07-27", "", 1),
      stop("day-one-late", "2026-07-26", "7:00 PM", 2),
      stop("day-one-early", "2026-07-26", "9:00 AM", 3),
    ], "2026-07-26", "2026-07-27");
    expect(groups.map(({ stops }) => stops.map(({ id }) => id))).toEqual([
      ["day-one-late", "day-one-early"],
      ["day-two-untimed"],
    ]);
  });

  it("inserts chronologically within the assigned day without crossing days", () => {
    const ordered = insertStopChronologically([
      stop("day-one-morning", "2026-07-26", "9:00 AM", 1),
      stop("day-one-untimed", "2026-07-26", "", 2),
      stop("day-two-evening", "2026-07-27", "7:00 PM", 3),
    ], stop("day-two-morning", "2026-07-27", "8:00 AM", 4), "2026-07-26");
    expect(ordered.map(({ id }) => id)).toEqual([
      "day-one-morning",
      "day-one-untimed",
      "day-two-morning",
      "day-two-evening",
    ]);
    expect(ordered.map(({ sortOrder }) => sortOrder)).toEqual([1, 2, 3, 4]);
  });

  it("preserves relative days when dates move and blocks a destructive shrink", () => {
    const stops = [
      stop("Day 1 breakfast", "2026-07-26"),
      stop("Day 3 hike", "2026-07-28", "", 2),
    ];
    expect(reconcileStopDaysForAdventureRange(
      stops,
      "2026-07-26",
      "2026-08-02",
      "2026-08-04",
    )).toMatchObject({
      ok: true,
      stops: [
        { dayDate: "2026-08-02" },
        { dayDate: "2026-08-04" },
      ],
    });
    expect(reconcileStopDaysForAdventureRange(
      stops,
      "2026-07-26",
      "2026-07-26",
      "2026-07-27",
    )).toEqual({
      ok: false,
      affectedTitles: ["Day 3 hike"],
    });
  });
});
