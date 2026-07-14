import { supabase } from "../lib/supabase";

export type AdventureCoordinates = {
  latitude: number;
  longitude: number;
  timezone: string;
  geocodedLocation: string;
};

type GeocodingResponse = {
  result?: {
    latitude?: unknown;
    longitude?: unknown;
    timezone?: unknown;
    normalizedLocation?: unknown;
  } | null;
};

export async function geocodeAdventureLocation(
  spaceId: string,
  location: string,
): Promise<AdventureCoordinates | null> {
  const { data, error } = await supabase.functions.invoke<GeocodingResponse>(
    "geocode-adventure-location",
    { body: { spaceId, query: location } },
  );
  if (error) {
    if (import.meta.env.DEV)
      console.warn("Adventure location geocoding failed", error.message);
    return null;
  }
  const result = data?.result;
  if (
    !result ||
    typeof result.latitude !== "number" ||
    !Number.isFinite(result.latitude) ||
    typeof result.longitude !== "number" ||
    !Number.isFinite(result.longitude) ||
    typeof result.timezone !== "string" ||
    !result.timezone ||
    typeof result.normalizedLocation !== "string"
  )
    return null;
  return {
    latitude: result.latitude,
    longitude: result.longitude,
    timezone: result.timezone,
    geocodedLocation: result.normalizedLocation,
  };
}
