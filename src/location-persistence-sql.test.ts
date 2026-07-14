import { describe, expect, it } from "vitest";
import migration from "../supabase/migrations/20260714193619_add_location_persistence_rpcs.sql?raw";
import weatherMigration from "../supabase/migrations/20260714030326_add_adventure_weather.sql?raw";

const locationColumns = [
  "location",
  "latitude",
  "longitude",
  "timezone",
  "geocoded_location",
  "location_provider",
  "location_provider_id",
  "location_address",
  "location_source",
  "location_confirmed_at",
];

describe("Phase 3 location RPC migration", () => {
  it("keeps promotion authenticated, member-scoped, and explicitly granted", () => {
    expect(migration).toContain(
      "create function public.promote_idea_to_adventure_v2(",
    );
    expect(migration).toContain("security definer\nset search_path = ''");
    expect(migration).toContain("current_user_id uuid := (select auth.uid())");
    expect(migration).toContain(
      "private.is_space_member(source_idea.space_id)",
    );
    expect(migration).toContain(
      "revoke execute on function public.promote_idea_to_adventure_v2(",
    );
    expect(migration).toContain(") from public, anon;");
    expect(migration).toContain(") to authenticated;");
    expect(migration).not.toContain("drop function public.promote_idea_to_adventure");
  });

  it("includes every normalized location field in promotion and duplication", () => {
    for (const column of locationColumns) {
      expect(migration).toContain(`p_${column}`);
      expect(migration).toContain(`source_adventure.${column}`);
      expect(migration).toContain(`stop.${column}`);
    }
  });

  it("preserves duplication authentication, membership, children, and grants", () => {
    expect(migration).toContain(
      "create or replace function public.duplicate_adventure(p_adventure_id uuid)",
    );
    expect(migration).toContain("caller_id uuid := (select auth.uid())");
    expect(migration).toContain(
      "private.is_space_member(source_adventure.space_id)",
    );
    expect(migration).toContain("insert into public.checklist_items");
    expect(migration).toContain("insert into public.adventure_links");
    expect(migration).toContain(
      "revoke execute on function public.duplicate_adventure(uuid) from public, anon;",
    );
    expect(migration).toContain(
      "grant execute on function public.duplicate_adventure(uuid) to authenticated;",
    );
  });

  it("retains weather invalidation for every weather-relevant location field", () => {
    for (const field of ["location", "latitude", "longitude", "timezone"]) {
      expect(weatherMigration).toContain(
        `old.${field} is distinct from new.${field}`,
      );
    }
  });
});
