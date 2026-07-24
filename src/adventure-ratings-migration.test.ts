import { describe, expect, it } from "vitest";
import migration from "../supabase/migrations/20260724033712_add_adventure_ratings.sql?raw";

describe("Adventure ratings migration", () => {
  it("creates normalized constrained ratings without derived aggregates", () => {
    expect(migration).toContain("create table public.adventure_ratings");
    expect(migration).toContain("check (rating between 1 and 5)");
    expect(migration).toContain("char_length(note) <= 500");
    expect(migration).toContain("unique (adventure_id, user_id)");
    expect(migration).toContain("references public.adventures(id) on delete cascade");
    expect(migration).not.toMatch(/average_rating|rating_count/);
  });

  it("uses the canonical effective end for direct-write completion gating", () => {
    expect(migration).toContain("private.is_adventure_complete");
    expect(migration).toContain(
      "coalesce(adventure.end_date, adventure.event_date) + adventure.end_time",
    );
    expect(migration).toContain("::date > adventure.end_date");
    expect(migration).toContain("guard_adventure_rating_completion_before_write");
    expect(migration).toContain("Only completed Adventures can be rated");
  });

  it("derives RPC ownership from auth and restricts execution", () => {
    expect(migration).toContain("caller_id uuid := (select auth.uid())");
    expect(migration).toContain("values (\n    p_adventure_id,\n    caller_id,");
    expect(migration).toContain("on conflict (adventure_id, user_id)");
    expect(migration).toMatch(
      /revoke execute on function public\.save_adventure_rating[\s\S]*from public, anon/,
    );
  });

  it("enforces member reads and self-only mutations with RLS", () => {
    expect(migration).toContain("alter table public.adventure_ratings enable row level security");
    expect(migration).toMatch(
      /for insert to authenticated[\s\S]*user_id = \(select auth\.uid\(\)\)/,
    );
    expect(migration).toMatch(
      /for update to authenticated[\s\S]*using \([\s\S]*user_id = \(select auth\.uid\(\)\)[\s\S]*with check/,
    );
    expect(migration).toMatch(
      /for delete to authenticated[\s\S]*user_id = \(select auth\.uid\(\)\)/,
    );
    expect(migration).not.toMatch(/disable row level security/i);
  });

  it("keeps former-member rows displayable and enables realtime reconciliation", () => {
    expect(migration).toContain("references public.profiles(id) on delete set null");
    expect(migration).toContain(
      "alter publication supabase_realtime add table public.adventure_ratings",
    );
  });
});
