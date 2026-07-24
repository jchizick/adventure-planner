import { describe, expect, it } from "vitest";
import migration from "../supabase/migrations/20260724020023_support_timed_single_day_and_itinerary_days.sql?raw";

describe("timed Adventure and itinerary day migration", () => {
  it("preserves existing records while enforcing new time writes", () => {
    expect(migration).toContain(
      "check (end_time is null or start_time is not null) not valid",
    );
    expect(migration).toMatch(/or end_time > start_time\s*\)\s*not valid/);
    expect(migration).not.toMatch(/\btruncate\b/i);
    expect(migration).not.toMatch(/\bdelete\s+from\s+public\.adventure_stops\b/i);
  });

  it("backfills Day 1 and validates stop days at the database boundary", () => {
    expect(migration).toContain("add column day_date date");
    expect(migration).toContain("set day_date = adventure.event_date");
    expect(migration).toContain("alter column day_date set not null");
    expect(migration).toContain(
      "new.day_date < adventure_start or new.day_date > adventure_end",
    );
    expect(migration).toContain(
      "Reassign or delete itinerary stops on removed days first",
    );
  });

  it("preserves relative days and copies assignments when duplicating", () => {
    expect(migration).toContain(
      "set day_date = new.event_date + (stop.day_date - old.event_date)",
    );
    expect(migration).toMatch(
      /adventure_id, title, day_date,[\s\S]*duplicate_id, stop\.title, stop\.day_date/,
    );
  });

  it("uses the effective same-day end for completion and memory access", () => {
    expect(migration).toContain(
      "coalesce(new.end_date, new.event_date) + new.end_time",
    );
    expect(migration).toContain(
      "coalesce(adventure.end_date, adventure.event_date) + adventure.end_time",
    );
    expect(migration).toContain(
      "Adventure end time requires a start time",
    );
  });

  it("does not weaken row-level authorization", () => {
    expect(migration).not.toMatch(/disable row level security/i);
    expect(migration).not.toMatch(/drop policy/i);
  });
});
