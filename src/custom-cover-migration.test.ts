import { describe, expect, it } from "vitest";
import migration from "../supabase/migrations/20260717184559_add_custom_idea_and_adventure_covers.sql?raw";

describe("custom cover migration", () => {
  it("adds nullable stable paths and a private constrained bucket", () => {
    expect(migration).toMatch(/alter table public\.ideas[\s\S]*add column cover_storage_path text/);
    expect(migration).toMatch(/alter table public\.adventures[\s\S]*add column cover_storage_path text/);
    expect(migration).toContain("'cover-images'");
    expect(migration).toMatch(/'cover-images',[\s\S]*false,[\s\S]*10485760/);
    expect(migration).toContain("array['image/jpeg', 'image/png', 'image/webp']");
  });

  it("scopes all object operations to authenticated current space members", () => {
    expect(migration).toContain('on storage.objects for select to authenticated');
    expect(migration).toContain('on storage.objects for insert to authenticated');
    expect(migration).toContain('on storage.objects for delete to authenticated');
    expect(migration.match(/private\.can_access_cover_path\(split_part\(name, '\/', 2\)\)/g))
      .toHaveLength(3);
    expect(migration).toContain("(ideas|adventures)");
    expect(migration).toContain("/cover/");
  });

  it("keeps promotion and Adventure duplication on stable shared references", () => {
    expect(migration).toContain("promote_idea_to_adventure_v4");
    expect(migration).toContain("coalesce(p_cover_storage_path, source_cover_storage_path)");
    expect(migration).toContain("source_adventure.cover_storage_path");
    expect(migration).toMatch(/revoke execute on function public\.promote_idea_to_adventure_v4[\s\S]*from public, anon/);
  });
});
