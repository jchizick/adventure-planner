import { describe, expect, it } from "vitest";
import promotionSource from "../supabase/migrations/20260717010424_proposed_idea_dates_and_multiday_adventures.sql?raw";
import cleanupSource from "../supabase/migrations/20260717015551_clear_promoted_idea_schedule.sql?raw";

const promotion = promotionSource.toLowerCase();
const cleanup = cleanupSource.toLowerCase();

describe("promoted Idea cleanup migration", () => {
  it("keeps the canonical link and confirmed state inside the atomic promotion RPC", () => {
    expect(promotion).toContain("update public.ideas set linked_adventure_id = created_adventure.id, status = 'confirmed'");
    expect(promotion).not.toContain("delete from public.ideas");
  });

  it("clears proposal scheduling in the same transaction that links the Idea", () => {
    expect(cleanup).toContain("before update of linked_adventure_id on public.ideas");
    expect(cleanup).toContain("new.proposed_start_date := null");
    expect(cleanup).toContain("new.proposed_start_time := null");
    expect(cleanup).toContain("new.proposed_end_date := null");
    expect(cleanup).toContain("new.proposed_end_time := null");
  });

  it("keeps the trigger helper private and preserves the Idea row", () => {
    expect(cleanup).toContain("set search_path = ''");
    expect(cleanup).toContain("from public, anon, authenticated");
    expect(cleanup).not.toContain("delete from public.ideas");
  });
});
