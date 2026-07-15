import { describe, expect, it } from "vitest";
import schema from "../supabase/migrations/20260712210045_initial_shared_space_schema.sql?raw";

describe("Idea deletion database behavior", () => {
  it("keeps promoted Adventures and clears only their Idea backlink", () => {
    expect(schema).toMatch(
      /source_idea_id\s+uuid\s+references\s+public\.ideas\(id\)\s+on delete set null/i,
    );
    expect(schema).toMatch(
      /ideas_linked_adventure_id_fkey[\s\S]*?references\s+public\.adventures\(id\)[\s\S]*?on delete set null/i,
    );
    expect(schema).not.toMatch(
      /source_idea_id\s+uuid\s+references\s+public\.ideas\(id\)\s+on delete cascade/i,
    );
  });

  it("retains membership-scoped delete authorization", () => {
    expect(schema).toMatch(
      /create policy "Members can delete ideas"[\s\S]*?for delete[\s\S]*?private\.is_space_member\(space_id\)/i,
    );
  });
});
