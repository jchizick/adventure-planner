import type { RealtimeChannel } from "@supabase/supabase-js";
import { supabase } from "../lib/supabase";
import type {
  AdventureRatingScore,
  AdventureRatingWithMember,
} from "../types";

type ProfileJoin =
  | { display_name: string | null; avatar_url: string | null }
  | { display_name: string | null; avatar_url: string | null }[]
  | null;

type RatingRow = {
  id: string;
  adventure_id: string;
  user_id: string | null;
  rating: number;
  would_do_again: boolean | null;
  note: string | null;
  created_at: string;
  updated_at: string;
  member_profile?: ProfileJoin;
};

const ratingColumns = `
  id, adventure_id, user_id, rating, would_do_again, note, created_at, updated_at,
  member_profile:profiles!adventure_ratings_user_id_fkey(display_name, avatar_url)
`;

function ratingError(action: string, error?: { message: string }) {
  if (import.meta.env.DEV && error)
    console.error(`Supabase Adventure ratings ${action} failed`, error.message);
  return new Error(`We could not ${action} this rating. Please try again.`);
}

function mapRating(row: RatingRow): AdventureRatingWithMember {
  const profile = Array.isArray(row.member_profile)
    ? row.member_profile[0]
    : row.member_profile;
  return {
    id: row.id,
    adventureId: row.adventure_id,
    userId: row.user_id,
    rating: row.rating as AdventureRatingScore,
    wouldDoAgain: row.would_do_again,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    memberName: profile?.display_name?.trim() || "Former member",
    memberAvatarUrl: profile?.avatar_url ?? null,
  };
}

export async function listAdventureRatings(
  adventureId: string,
): Promise<AdventureRatingWithMember[]> {
  const { data, error } = await supabase
    .from("adventure_ratings")
    .select(ratingColumns)
    .eq("adventure_id", adventureId)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw ratingError("load", error);
  return ((data ?? []) as unknown as RatingRow[]).map(mapRating);
}

export async function listRatingsForAdventures(
  adventureIds: string[],
): Promise<AdventureRatingWithMember[]> {
  if (!adventureIds.length) return [];
  const { data, error } = await supabase
    .from("adventure_ratings")
    .select(ratingColumns)
    .in("adventure_id", adventureIds)
    .order("created_at", { ascending: true })
    .order("id", { ascending: true });
  if (error) throw ratingError("load", error);
  return ((data ?? []) as unknown as RatingRow[]).map(mapRating);
}

export async function getCurrentUserAdventureRating(
  adventureId: string,
  currentUserId: string,
) {
  const ratings = await listAdventureRatings(adventureId);
  return ratings.find((rating) => rating.userId === currentUserId) ?? null;
}

export async function saveCurrentUserRating({
  adventureId,
  rating,
  wouldDoAgain,
  note,
}: {
  adventureId: string;
  rating: AdventureRatingScore;
  wouldDoAgain: boolean | null;
  note: string | null;
}) {
  const { error } = await supabase.rpc("save_adventure_rating", {
    p_adventure_id: adventureId,
    p_rating: rating,
    p_would_do_again: wouldDoAgain,
    p_note: note,
  });
  if (error) throw ratingError("save", error);
  const ratings = await listAdventureRatings(adventureId);
  return ratings;
}

export async function deleteCurrentUserRating(ratingId: string) {
  const { error } = await supabase
    .from("adventure_ratings")
    .delete()
    .eq("id", ratingId);
  if (error) throw ratingError("remove", error);
}

export function subscribeToAdventureRatings(
  subscriptionKey: string,
  onChange: () => void,
): RealtimeChannel {
  return supabase
    .channel(`adventure-ratings:${subscriptionKey}`)
    .on(
      "postgres_changes",
      { event: "*", schema: "public", table: "adventure_ratings" },
      onChange,
    )
    .subscribe();
}

export async function unsubscribeFromAdventureRatings(channel: RealtimeChannel) {
  await supabase.removeChannel(channel);
}
