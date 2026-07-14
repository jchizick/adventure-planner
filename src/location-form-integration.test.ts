import { describe, expect, it } from "vitest";
import pagesSource from "./pages.tsx?raw";

describe("location form integration", () => {
  it("passes explicit drafts from Adventure and stop forms", () => {
    expect(pagesSource).toContain("location: locationDraft.label");
    expect(pagesSource).toContain("locationDraft: value.locationDraft");
    expect(pagesSource).toContain("savedLocation={a.savedLocation}");
    expect(pagesSource).toContain("adventureId={a.id}");
  });

  it("uses the shared field for Idea promotion without legacy geocoding", () => {
    expect(pagesSource).toContain(
      "initialLocationDraft(savedLocation, base.location)",
    );
    expect(pagesSource).not.toContain("geocode-adventure-location");
    expect(pagesSource).not.toContain("geocodeAdventureLocation");
  });
});
