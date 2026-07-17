import { describe, expect, it } from "vitest";
import migrationSource from "../supabase/migrations/20260716202041_improve_idea_links_and_categories.sql?raw";

const migration = migrationSource.toLocaleLowerCase();

describe("Idea links and categories migration", () => {
  it("admits the new stable category slugs without rewriting Culture records", () => {
    expect(migration).toContain("'culture'");
    expect(migration).toContain("'social'");
    expect(migration).toContain("'errands'");
    expect(migration).not.toMatch(/update public\.ideas\s+set category/);
  });

  it("copies a safe Idea URL into the promoted Adventure atomically", () => {
    expect(migration).toContain("source_idea.optional_link");
    expect(migration).toContain("insert into public.adventure_links");
    expect(migration).toContain("values (created_adventure.id, 'website', normalized_idea_url, 1)");
    expect(migration).toContain("update public.ideas");
  });

  it("keeps the privileged promotion RPC locked to authenticated callers", () => {
    expect(migration).toContain("security definer");
    expect(migration).toContain("set search_path = ''");
    expect(migration).toContain("private.is_space_member(source_idea.space_id)");
    expect(migration).toContain("from public, anon");
    expect(migration).toContain("to authenticated");
  });
});
