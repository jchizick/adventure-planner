import { describe, expect, it } from "vitest";
import {
  FINAL_STOP_COLOR,
  ITINERARY_STOP_COLORS,
  buildStopMapCameraTarget,
  geoapifyMapStyleUrl,
  prepareStopMap,
  reconcileSelectedStopId,
  stopMapCameraDuration,
} from "./adventure-stops-map";
import type { AdventureStop, LocationCandidate, SavedLocation } from "./types";

function savedLocation(
  latitude: number,
  longitude: number,
): SavedLocation {
  const candidate: LocationCandidate = {
    provider: "geoapify",
    providerPlaceId: `${latitude}:${longitude}`,
    label: "Selected place",
    formattedAddress: "Selected place, Ontario, Canada",
    address: { region: "Ontario", country: "Canada" },
    source: { name: "openstreetmap", attribution: "OpenStreetMap" },
    latitude,
    longitude,
  };
  return {
    kind: "confirmed",
    label: candidate.label,
    candidate,
    confirmedAt: "2026-07-14T20:00:00.000Z",
  };
}

function stop(
  id: string,
  location: SavedLocation = { kind: "none", label: "" },
): AdventureStop {
  return {
    id,
    title: `Stop ${id}`,
    dayDate: "2026-07-26",
    location: location.label,
    savedLocation: location,
    startTime: "",
    sortOrder: Number(id.replace(/\D/g, "")) || 0,
  };
}

describe("prepareStopMap", () => {
  it("represents empty and entirely unresolved itineraries without markers", () => {
    expect(prepareStopMap([])).toEqual({
      markers: [],
      totalStops: 0,
      mappedCount: 0,
      finalStopMapped: false,
    });
    expect(prepareStopMap([stop("1"), stop("2")])).toMatchObject({
      markers: [],
      totalStops: 2,
      mappedCount: 0,
      finalStopMapped: false,
    });
  });

  it("keeps full itinerary numbering and position colors across mapping gaps", () => {
    const prepared = prepareStopMap([
      stop("1", savedLocation(43.65, -79.38)),
      stop("2"),
      stop("3", savedLocation(43.66, -79.39)),
      stop("4"),
    ]);
    expect(prepared.markers.map((marker) => marker.displayNumber)).toEqual([
      1, 3,
    ]);
    expect(prepared.markers.map((marker) => marker.color)).toEqual([
      ITINERARY_STOP_COLORS[0],
      ITINERARY_STOP_COLORS[2],
    ]);
    expect(prepared).toMatchObject({
      totalStops: 4,
      mappedCount: 2,
      finalStopMapped: false,
    });
  });

  it("uses the purple flag only for the actual final itinerary stop", () => {
    const prepared = prepareStopMap([
      stop("1", savedLocation(43.65, -79.38)),
      stop("2", savedLocation(43.66, -79.39)),
    ]);
    expect(prepared.markers[0]).toMatchObject({
      isActualFinalStop: false,
      color: ITINERARY_STOP_COLORS[0],
    });
    expect(prepared.markers[1]).toMatchObject({
      isActualFinalStop: true,
      color: FINAL_STOP_COLOR,
      accessibleLabel: "Final stop 2: Stop 2",
    });
    expect(prepared.finalStopMapped).toBe(true);
  });

  it("does not promote the last resolved marker when the true final stop is unresolved", () => {
    const prepared = prepareStopMap([
      stop("1", savedLocation(43.65, -79.38)),
      stop("2", savedLocation(43.66, -79.39)),
      stop("3", { kind: "text", label: "Somewhere later" }),
    ]);
    expect(prepared.markers.every((marker) => !marker.isActualFinalStop)).toBe(
      true,
    );
    expect(prepared.markers.some((marker) => marker.color === FINAL_STOP_COLOR)).toBe(
      false,
    );
    expect(prepared.finalStopMapped).toBe(false);
  });

  it("filters invalid coordinates without fabricating a replacement", () => {
    const prepared = prepareStopMap([
      stop("1", savedLocation(91, -79.38)),
      stop("2", savedLocation(43.65, -181)),
    ]);
    expect(prepared.markers).toEqual([]);
  });

  it("preserves duplicate-coordinate stops and offsets later markers", () => {
    const prepared = prepareStopMap([
      stop("1", savedLocation(43.65, -79.38)),
      stop("2", savedLocation(43.65, -79.38)),
      stop("3", savedLocation(43.65, -79.38)),
    ]);
    expect(prepared.markers).toHaveLength(3);
    expect(prepared.markers.map((marker) => marker.offset)).toEqual([
      [0, 0],
      [14, 0],
      [10, 10],
    ]);
  });

  it("derives marker order from the provided persisted itinerary order", () => {
    const first = stop("1", savedLocation(43.65, -79.38));
    const second = stop("2", savedLocation(43.66, -79.39));
    expect(prepareStopMap([second, first]).markers.map((marker) => marker.stopId)).toEqual([
      "2",
      "1",
    ]);
  });
});

describe("stop map camera and selection", () => {
  it("uses a capped close zoom for one marker", () => {
    const markers = prepareStopMap([
      stop("1", savedLocation(43.65, -79.38)),
    ]).markers;
    expect(buildStopMapCameraTarget(markers)).toEqual({
      kind: "single",
      center: [-79.38, 43.65],
      zoom: 14,
    });
  });

  it("fits widely separated markers and caps the resulting zoom", () => {
    const markers = prepareStopMap([
      stop("1", savedLocation(43.65, -79.38)),
      stop("2", savedLocation(51.5, -0.12)),
    ]).markers;
    expect(buildStopMapCameraTarget(markers)).toEqual({
      kind: "bounds",
      southwest: [-79.38, 43.65],
      northeast: [-0.12, 51.5],
      maxZoom: 14,
    });
  });

  it("expands duplicate-coordinate bounds enough for deterministic fitting", () => {
    const markers = prepareStopMap([
      stop("1", savedLocation(43.65, -79.38)),
      stop("2", savedLocation(43.65, -79.38)),
    ]).markers;
    const target = buildStopMapCameraTarget(markers);
    expect(target?.kind).toBe("bounds");
    if (target?.kind !== "bounds") throw new Error("Expected bounds target");
    expect(target.southwest[0]).toBeCloseTo(-79.3815);
    expect(target.southwest[1]).toBeCloseTo(43.6485);
    expect(target.northeast[0]).toBeCloseTo(-79.3785);
    expect(target.northeast[1]).toBeCloseTo(43.6515);
    expect(target.maxZoom).toBe(14);
  });

  it("clears selection when a selected stop is no longer mapped", () => {
    const markers = prepareStopMap([
      stop("1", savedLocation(43.65, -79.38)),
    ]).markers;
    expect(reconcileSelectedStopId("1", markers)).toBe("1");
    expect(reconcileSelectedStopId("missing", markers)).toBeNull();
  });

  it("removes camera animation under reduced motion", () => {
    expect(stopMapCameraDuration(true)).toBe(0);
    expect(stopMapCameraDuration(false)).toBeGreaterThan(0);
  });

  it("builds the documented Geoapify MapLibre style URL", () => {
    expect(geoapifyMapStyleUrl("key with spaces")).toBe(
      "https://maps.geoapify.com/v1/styles/osm-bright-grey/style.json?apiKey=key%20with%20spaces",
    );
  });
});
