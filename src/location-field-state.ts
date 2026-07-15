import type { LocationCandidate, LocationDraft, SavedLocation } from "./types";

export function initialLocationDraft(
  savedLocation: SavedLocation,
  initialLabel = savedLocation.label,
): LocationDraft {
  if (savedLocation.kind !== "none") {
    return { label: savedLocation.label, intent: "preserve" };
  }

  return initialLabel.trim()
    ? { label: initialLabel, intent: "text-only" }
    : { label: "", intent: "clear" };
}

export function editLocationDraft(label: string): LocationDraft {
  return label.trim()
    ? { label, intent: "text-only" }
    : { label: "", intent: "clear" };
}

export function selectLocationDraft(
  candidate: LocationCandidate,
): LocationDraft {
  return {
    label: candidate.label,
    intent: "selected",
    candidate,
  };
}

export function shouldShowTextOnlyWarning(
  draft: LocationDraft,
  savedLocation: SavedLocation,
) {
  if (!draft.label.trim()) return false;
  if (draft.intent === "text-only") return true;
  return draft.intent === "preserve" && savedLocation.kind === "text";
}
