import { describe, expect, it } from "vitest";
import migrationSource from "../supabase/migrations/20260717010424_proposed_idea_dates_and_multiday_adventures.sql?raw";

const migration = migrationSource.toLowerCase();

describe("proposed dates migration", () => {
  it("adds nullable proposal and Adventure end fields with durable ordering constraints", () => {
    expect(migration).toContain("proposed_start_date date");
    expect(migration).toContain("proposed_end_time time");
    expect(migration).toContain("add column end_date date");
    expect(migration).toContain("adventures_end_date_order_check");
  });

  it("keeps promotion atomic and authenticated", () => {
    expect(migration).toContain("promote_idea_to_adventure_v3");
    expect(migration).toContain("security definer set search_path = ''");
    expect(migration).toContain("insert into public.adventure_links");
    expect(migration).toContain("update public.ideas set linked_adventure_id");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
  });

  it("copies end dates and protects weather and memory behavior", () => {
    expect(migration).toContain("source_adventure.end_date");
    expect(migration).toContain("old.end_date is distinct from new.end_date");
    expect(migration).toContain("guard_multiday_adventure_completion");
    expect(migration).toContain("is_completed_adventure_member");
  });
});
