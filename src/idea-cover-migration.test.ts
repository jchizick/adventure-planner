import { describe, expect, it } from "vitest";
import migrationSource from "../supabase/migrations/20260715154332_add_idea_cover_presets.sql?raw";

const migration = migrationSource.toLocaleLowerCase();

describe("Idea cover migration", () => {
  it("is additive, nullable, and narrowly constrained", () => {
    expect(migration).toContain("alter table public.ideas");
    expect(migration).toContain("add column cover_preset_id text");
    expect(migration).toContain("cover_preset_id is null");
    expect(migration).toContain("btrim(cover_preset_id)");
    expect(migration).not.toMatch(/add column cover_preset_id text\s+not null/);
  });

  it("does not backfill or alter authorization and storage", () => {
    expect(migration).not.toMatch(/\bupdate\b|\binsert\b|\bdelete\b/);
    expect(migration).not.toMatch(/\bpolicy\b|row level security|\bgrant\b/);
    expect(migration).not.toMatch(/\bfunction\b|\btrigger\b|storage\./);
  });
});
