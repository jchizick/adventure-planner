import { describe, expect, it } from "vitest";
import {
  editLocationDraft,
  initialLocationDraft,
  selectLocationDraft,
  shouldShowTextOnlyWarning,
} from "./location-field-state";
import type { LocationCandidate, SavedLocation } from "./types";

const candidate: LocationCandidate = {
  provider: "geoapify",
  providerPlaceId: "toronto",
  label: "Toronto, Ontario",
  formattedAddress: "Toronto, Ontario, Canada",
  address: { city: "Toronto", region: "Ontario", country: "Canada" },
  source: {
    name: "openstreetmap",
    attribution: "© OpenStreetMap contributors",
  },
  latitude: 43.6532,
  longitude: -79.3832,
};

const confirmed: SavedLocation = {
  kind: "confirmed",
  label: candidate.label,
  candidate,
  confirmedAt: "2026-07-14T20:00:00.000Z",
};

const legacy: SavedLocation = {
  kind: "legacy",
  label: "Toronto",
  latitude: 43.6532,
  longitude: -79.3832,
  timezone: "America/Toronto",
};

describe("location field intent transitions", () => {
  it("preserves untouched confirmed, legacy, and text locations", () => {
    expect(initialLocationDraft(confirmed)).toEqual({
      label: candidate.label,
      intent: "preserve",
    });
    expect(initialLocationDraft(legacy)).toEqual({
      label: "Toronto",
      intent: "preserve",
    });
    expect(
      initialLocationDraft({ kind: "text", label: "West entrance" }),
    ).toEqual({ label: "West entrance", intent: "preserve" });
  });

  it("starts new and Idea-provided raw text as text-only", () => {
    expect(
      initialLocationDraft({ kind: "none", label: "" }, "Toronto"),
    ).toEqual({ label: "Toronto", intent: "text-only" });
  });

  it("invalidates saved metadata on edit and never resurrects it by label equality", () => {
    expect(editLocationDraft("Toronto, Ontario")).toEqual({
      label: "Toronto, Ontario",
      intent: "text-only",
    });
  });

  it("emits selected and clear intents", () => {
    expect(selectLocationDraft(candidate)).toEqual({
      label: candidate.label,
      intent: "selected",
      candidate,
    });
    expect(editLocationDraft("  ")).toEqual({ label: "", intent: "clear" });
  });

  it("shows the warning only for non-empty text-only drafts", () => {
    expect(
      shouldShowTextOnlyWarning({ label: "Toronto", intent: "text-only" }),
    ).toBe(true);
    expect(
      shouldShowTextOnlyWarning({ label: "Toronto", intent: "preserve" }),
    ).toBe(false);
    expect(
      shouldShowTextOnlyWarning({
        label: candidate.label,
        intent: "selected",
        candidate,
      }),
    ).toBe(false);
    expect(shouldShowTextOnlyWarning({ label: "", intent: "clear" })).toBe(
      false,
    );
  });
});
