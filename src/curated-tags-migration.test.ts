import { describe, expect, it } from "vitest";
import migrationSource from "../supabase/migrations/20260724025507_add_curated_tags.sql?raw";

const migration = migrationSource.toLocaleLowerCase();

describe("curated tags migration", () => {
  it("creates normalized assignments with deterministic seed data and cascades", () => {
    expect(migration).toContain("create table public.tags");
    expect(migration).toContain("create table public.idea_tags");
    expect(migration).toContain("create table public.adventure_tags");
    expect(migration).toContain("references public.ideas(id) on delete cascade");
    expect(migration).toContain("references public.adventures(id) on delete cascade");
    for (const slug of [
      "date-night",
      "friends-family",
      "archie-friendly",
      "seasonal",
      "rainy-day",
      "recurring",
    ]) {
      expect(migration).toContain(`'${slug}'`);
    }
    expect(migration).toContain("on conflict (id) do update");
  });

  it("keeps definitions read-only and scopes assignment policies through parents", () => {
    expect(migration).toContain("alter table public.tags enable row level security");
    expect(migration).toContain("grant select on table public.tags to authenticated");
    expect(migration).not.toContain("grant insert on table public.tags");
    expect(migration).toContain("private.is_space_member(idea.space_id)");
    expect(migration).toContain("private.is_space_member(adventure.space_id)");
    expect(migration).toContain("revoke all on table public.idea_tags from anon, authenticated");
    expect(migration).toContain("revoke all on table public.adventure_tags from anon, authenticated");
  });

  it("migrates Date Night intent, rejects it as a category, and copies tags atomically", () => {
    expect(migration).toContain("idea.is_date_night");
    expect(migration).toContain("set category = 'social'");
    expect(migration).toContain("add constraint ideas_category_check");
    expect(migration).toContain("alter column category set not null");
    expect(migration).toContain("promote_idea_to_adventure_v5");
    expect(migration).toContain("insert into public.adventure_tags");
    expect(migration).toContain("where assignment.adventure_id = p_adventure_id");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toMatch(/revoke execute on function public\.promote_idea_to_adventure_v5[\s\S]*from public, anon/);
  });
});
