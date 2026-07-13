import { supabase } from "../lib/supabase";
import type { ChecklistItem } from "../types";

type ChecklistRow = {
  id: string;
  adventure_id: string;
  label: string;
  is_complete: boolean;
  sort_order: number;
  created_by: string;
};

const columns =
  "id, adventure_id, label, is_complete, sort_order, created_by, created_at, updated_at";

function mapChecklistItem(row: ChecklistRow): ChecklistItem {
  return {
    id: row.id,
    label: row.label,
    completed: row.is_complete,
    sortOrder: row.sort_order,
    createdBy: row.created_by,
  };
}

function repositoryError(action: string, error: { message: string }) {
  if (import.meta.env.DEV)
    console.error(`Supabase checklist ${action} failed`, error.message);
  return new Error(`We could not ${action} this checklist. Please try again.`);
}

export async function loadChecklist(adventureId: string) {
  const { data, error } = await supabase
    .from("checklist_items")
    .select(columns)
    .eq("adventure_id", adventureId)
    .order("sort_order");
  if (error) throw repositoryError("load", error);
  return ((data ?? []) as ChecklistRow[]).map(mapChecklistItem);
}

export async function createChecklistItem(
  adventureId: string,
  userId: string,
  label: string,
  sortOrder: number,
) {
  const { data, error } = await supabase
    .from("checklist_items")
    .insert({
      adventure_id: adventureId,
      created_by: userId,
      label: label.trim(),
      is_complete: false,
      sort_order: sortOrder,
    })
    .select(columns)
    .single();
  if (error) throw repositoryError("add to", error);
  return mapChecklistItem(data as ChecklistRow);
}

export async function updateChecklistItem(
  adventureId: string,
  itemId: string,
  changes: { label?: string; completed?: boolean },
) {
  const values: { label?: string; is_complete?: boolean } = {};
  if (changes.label !== undefined) values.label = changes.label.trim();
  if (changes.completed !== undefined) values.is_complete = changes.completed;
  const { data, error } = await supabase
    .from("checklist_items")
    .update(values)
    .eq("adventure_id", adventureId)
    .eq("id", itemId)
    .select(columns)
    .single();
  if (error) throw repositoryError("update", error);
  return mapChecklistItem(data as ChecklistRow);
}

export async function deleteChecklistItem(adventureId: string, itemId: string) {
  const { error } = await supabase
    .from("checklist_items")
    .delete()
    .eq("adventure_id", adventureId)
    .eq("id", itemId);
  if (error) throw repositoryError("delete from", error);
}

export async function reorderChecklist(adventureId: string, orderedIds: string[]) {
  const { error } = await supabase.rpc("reorder_checklist_items", {
    p_adventure_id: adventureId,
    p_ordered_ids: orderedIds,
  });
  if (error) throw repositoryError("reorder", error);
}
