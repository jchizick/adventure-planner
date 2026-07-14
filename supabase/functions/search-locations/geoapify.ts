import type {
  LocationCandidate,
  LocationSource,
  NormalizedAddress,
} from "../../../src/types.ts";

export const GEOAPIFY_AUTOCOMPLETE_URL =
  "https://api.geoapify.com/v1/geocode/autocomplete";
export const GEOAPIFY_RESULT_LIMIT = 6;

export type LocationBias = {
  latitude: number;
  longitude: number;
};

export class MalformedGeoapifyResponseError extends Error {
  constructor() {
    super("Geoapify returned a malformed response.");
    this.name = "MalformedGeoapifyResponseError";
  }
}

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function text(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function coordinatesAreValid(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function addressFromResult(result: Record<string, unknown>) {
  const fields = {
    name: text(result.name),
    addressLine1: text(result.address_line1),
    addressLine2: text(result.address_line2),
    city: text(result.city),
    county: text(result.county),
    region: text(result.state),
    regionCode: text(result.state_code),
    postcode: text(result.postcode),
    country: text(result.country),
    countryCode: text(result.country_code),
  } satisfies Record<keyof NormalizedAddress, string | null>;
  const address: NormalizedAddress = {};
  for (const [key, value] of Object.entries(fields)) {
    if (value) address[key as keyof NormalizedAddress] = value;
  }
  return Object.keys(address).length ? address : null;
}

function sourceFromResult(result: Record<string, unknown>) {
  const datasource = record(result.datasource);
  if (!datasource) return null;
  const name = text(datasource.sourcename) ?? text(datasource.name);
  const attribution = text(datasource.attribution);
  if (!name || !attribution) return null;
  const license = text(datasource.license);
  const url = text(datasource.url);
  return {
    name,
    attribution,
    ...(license ? { license } : {}),
    ...(url ? { url } : {}),
  } satisfies LocationSource;
}

function normalizeResult(value: unknown): LocationCandidate | null {
  const result = record(value);
  if (!result) return null;
  const providerPlaceId = text(result.place_id);
  const formattedAddress = text(result.formatted);
  const latitude = result.lat;
  const longitude = result.lon;
  const address = addressFromResult(result);
  const source = sourceFromResult(result);
  if (
    !providerPlaceId ||
    !formattedAddress ||
    typeof latitude !== "number" ||
    typeof longitude !== "number" ||
    !coordinatesAreValid(latitude, longitude) ||
    !address ||
    !source
  )
    return null;

  const timezone = text(record(result.timezone)?.name);
  return {
    provider: "geoapify",
    providerPlaceId,
    label: text(result.name) ?? formattedAddress,
    formattedAddress,
    address,
    source,
    latitude,
    longitude,
    ...(timezone ? { timezone } : {}),
  };
}

export function normalizeGeoapifyResponse(
  payload: unknown,
): LocationCandidate[] {
  const root = record(payload);
  if (!root || !Array.isArray(root.results))
    throw new MalformedGeoapifyResponseError();

  const seen = new Set<string>();
  const candidates: LocationCandidate[] = [];
  for (const result of root.results) {
    const candidate = normalizeResult(result);
    if (!candidate || seen.has(candidate.providerPlaceId)) continue;
    seen.add(candidate.providerPlaceId);
    candidates.push(candidate);
  }
  return candidates;
}

export function buildGeoapifyAutocompleteUrl(
  query: string,
  apiKey: string,
  bias?: LocationBias,
) {
  const url = new URL(GEOAPIFY_AUTOCOMPLETE_URL);
  url.searchParams.set("text", query);
  url.searchParams.set("format", "json");
  url.searchParams.set("limit", String(GEOAPIFY_RESULT_LIMIT));
  url.searchParams.set("lang", "en");
  url.searchParams.set(
    "bias",
    bias
      ? `proximity:${bias.longitude},${bias.latitude}|countrycode:none`
      : "countrycode:none",
  );
  url.searchParams.set("apiKey", apiKey);
  return url;
}
