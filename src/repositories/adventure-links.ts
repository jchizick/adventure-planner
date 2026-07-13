import { supabase } from "../lib/supabase";
import type { AdventureLink } from "../types";

type LinkRow = {
  id: string;
  adventure_id: string;
  label: string;
  url: string;
  sort_order: number;
};

const columns = "id, adventure_id, label, url, sort_order, created_at, updated_at";

function mapLink(row: LinkRow): AdventureLink {
  return { id: row.id, label: row.label, url: row.url, sortOrder: row.sort_order };
}

export function normalizeLinkUrl(value: string) {
  const candidate = value.trim();
  const withScheme = /^[a-z][a-z\d+.-]*:/i.test(candidate)
    ? candidate
    : `https://${candidate}`;
  const parsed = new URL(withScheme);
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:")
    throw new Error("Use a safe http or https link.");
  return parsed.toString();
}

function repositoryError(action: string, error: { message: string }) {
  if (import.meta.env.DEV)
    console.error(`Supabase links ${action} failed`, error.message);
  return new Error(`We could not ${action} this link. Please try again.`);
}

export async function loadLinks(adventureId: string) {
  const { data, error } = await supabase
    .from("adventure_links")
    .select(columns)
    .eq("adventure_id", adventureId)
    .order("sort_order");
  if (error) throw repositoryError("load", error);
  return ((data ?? []) as LinkRow[]).map(mapLink);
}

export async function createLink(
  adventureId: string,
  label: string,
  url: string,
  sortOrder: number,
) {
  const { data, error } = await supabase
    .from("adventure_links")
    .insert({ adventure_id: adventureId, label: label.trim(), url: normalizeLinkUrl(url), sort_order: sortOrder })
    .select(columns)
    .single();
  if (error) throw repositoryError("add", error);
  return mapLink(data as LinkRow);
}

export async function updateLink(
  adventureId: string,
  linkId: string,
  label: string,
  url: string,
) {
  const { data, error } = await supabase
    .from("adventure_links")
    .update({ label: label.trim(), url: normalizeLinkUrl(url) })
    .eq("adventure_id", adventureId)
    .eq("id", linkId)
    .select(columns)
    .single();
  if (error) throw repositoryError("update", error);
  return mapLink(data as LinkRow);
}

export async function deleteLink(adventureId: string, linkId: string) {
  const { error } = await supabase
    .from("adventure_links")
    .delete()
    .eq("adventure_id", adventureId)
    .eq("id", linkId);
  if (error) throw repositoryError("delete", error);
}
