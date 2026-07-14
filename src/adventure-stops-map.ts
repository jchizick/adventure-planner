import type { AdventureStop } from "./types";

export const ITINERARY_STOP_COLORS = [
  "#b94d45",
  "#ad6425",
  "#5477a8",
  "#567c50",
  "#3e817c",
  "#916817",
] as const;
export const FINAL_STOP_COLOR = "#6d5cac";

export type StopMapMarker = {
  stopId: string;
  title: string;
  displayIndex: number;
  displayNumber: number;
  color: string;
  isActualFinalStop: boolean;
  latitude: number;
  longitude: number;
  offset: readonly [number, number];
  accessibleLabel: string;
};

export type PreparedStopMap = {
  markers: StopMapMarker[];
  totalStops: number;
  mappedCount: number;
  finalStopMapped: boolean;
};

export type StopMapCameraTarget =
  | {
      kind: "single";
      center: readonly [number, number];
      zoom: number;
    }
  | {
      kind: "bounds";
      southwest: readonly [number, number];
      northeast: readonly [number, number];
      maxZoom: number;
    };

export type AdventureStopsMapModuleProps = {
  markers: readonly StopMapMarker[];
  cameraTarget: StopMapCameraTarget;
  mapKey: string;
  selectedStopId: string | null;
  onSelectStop: (stopId: string) => void;
  onFailure: (stage: "initialization" | "style" | "webgl") => void;
};

export function getItineraryStopColor(
  displayIndex: number,
  isActualFinalStop: boolean,
) {
  return isActualFinalStop
    ? FINAL_STOP_COLOR
    : ITINERARY_STOP_COLORS[
        displayIndex % ITINERARY_STOP_COLORS.length
      ];
}

export function validMapCoordinates(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function duplicateOffset(occurrence: number): readonly [number, number] {
  if (occurrence === 0) return [0, 0];
  const position = occurrence - 1;
  const ring = Math.floor(position / 8) + 1;
  const angle = ((position % 8) * Math.PI) / 4;
  const radius = ring * 14;
  return [
    Math.round(Math.cos(angle) * radius),
    Math.round(Math.sin(angle) * radius),
  ];
}

/** Receives stops already sorted by persisted itinerary order. */
export function prepareStopMap(
  orderedStops: readonly AdventureStop[],
): PreparedStopMap {
  const finalIndex = orderedStops.length - 1;
  const coordinateOccurrences = new Map<string, number>();
  const markers: StopMapMarker[] = [];

  orderedStops.forEach((stop, displayIndex) => {
    if (stop.savedLocation.kind !== "confirmed") return;
    const { latitude, longitude } = stop.savedLocation.candidate;
    if (!validMapCoordinates(latitude, longitude)) return;

    const coordinateKey = `${latitude}:${longitude}`;
    const occurrence = coordinateOccurrences.get(coordinateKey) ?? 0;
    coordinateOccurrences.set(coordinateKey, occurrence + 1);
    const isActualFinalStop = displayIndex === finalIndex;
    const displayNumber = displayIndex + 1;
    markers.push({
      stopId: stop.id,
      title: stop.title,
      displayIndex,
      displayNumber,
      color: getItineraryStopColor(displayIndex, isActualFinalStop),
      isActualFinalStop,
      latitude,
      longitude,
      offset: duplicateOffset(occurrence),
      accessibleLabel: isActualFinalStop
        ? `Final stop ${displayNumber}: ${stop.title}`
        : `Stop ${displayNumber}: ${stop.title}`,
    });
  });

  return {
    markers,
    totalStops: orderedStops.length,
    mappedCount: markers.length,
    finalStopMapped: markers.some((marker) => marker.isActualFinalStop),
  };
}

export function buildStopMapCameraTarget(
  markers: readonly StopMapMarker[],
): StopMapCameraTarget | null {
  if (markers.length === 0) return null;
  if (markers.length === 1) {
    return {
      kind: "single",
      center: [markers[0].longitude, markers[0].latitude],
      zoom: 14,
    };
  }

  let west = markers[0].longitude;
  let east = markers[0].longitude;
  let south = markers[0].latitude;
  let north = markers[0].latitude;
  for (const marker of markers.slice(1)) {
    west = Math.min(west, marker.longitude);
    east = Math.max(east, marker.longitude);
    south = Math.min(south, marker.latitude);
    north = Math.max(north, marker.latitude);
  }

  if (west === east) {
    west -= 0.0015;
    east += 0.0015;
  }
  if (south === north) {
    south -= 0.0015;
    north += 0.0015;
  }

  return {
    kind: "bounds",
    southwest: [west, south],
    northeast: [east, north],
    maxZoom: 14,
  };
}

export function stopMapPadding(containerWidth: number) {
  return containerWidth < 390 ? 34 : 46;
}

export function stopMapCameraDuration(prefersReducedMotion: boolean) {
  return prefersReducedMotion ? 0 : 420;
}

export function reconcileSelectedStopId(
  selectedStopId: string | null,
  markers: readonly StopMapMarker[],
) {
  return selectedStopId &&
    markers.some((marker) => marker.stopId === selectedStopId)
    ? selectedStopId
    : null;
}

export function geoapifyMapStyleUrl(mapKey: string) {
  return `https://maps.geoapify.com/v1/styles/osm-bright-grey/style.json?apiKey=${encodeURIComponent(mapKey)}`;
}

