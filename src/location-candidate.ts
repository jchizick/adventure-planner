import type {
  LocationCandidate,
  LocationSource,
  NormalizedAddress,
} from "./types";

const addressKeys = [
  "name",
  "addressLine1",
  "addressLine2",
  "city",
  "county",
  "region",
  "regionCode",
  "postcode",
  "country",
  "countryCode",
] as const satisfies readonly (keyof NormalizedAddress)[];

function record(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function requiredText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function optionalText(value: unknown) {
  if (value === undefined) return undefined;
  return requiredText(value) ?? null;
}

function parseAddress(value: unknown): NormalizedAddress | null {
  const input = record(value);
  if (!input) return null;
  const address: NormalizedAddress = {};
  for (const key of addressKeys) {
    const part = optionalText(input[key]);
    if (part === null) return null;
    if (part !== undefined) address[key] = part;
  }
  return Object.keys(address).length ? address : null;
}

function parseSource(value: unknown): LocationSource | null {
  const input = record(value);
  if (!input) return null;
  const name = requiredText(input.name);
  const attribution = requiredText(input.attribution);
  const license = optionalText(input.license);
  const url = optionalText(input.url);
  if (!name || !attribution || license === null || url === null) return null;
  return {
    name,
    attribution,
    ...(license ? { license } : {}),
    ...(url ? { url } : {}),
  };
}

export function parseLocationCandidate(value: unknown): LocationCandidate | null {
  const input = record(value);
  if (!input) return null;
  const provider = requiredText(input.provider);
  const providerPlaceId = requiredText(input.providerPlaceId);
  const label = requiredText(input.label);
  const formattedAddress = requiredText(input.formattedAddress);
  const address = parseAddress(input.address);
  const source = parseSource(input.source);
  const latitude = input.latitude;
  const longitude = input.longitude;
  const timezone = optionalText(input.timezone);
  if (
    !provider ||
    !providerPlaceId ||
    !label ||
    !formattedAddress ||
    !address ||
    !source ||
    typeof latitude !== "number" ||
    !Number.isFinite(latitude) ||
    latitude < -90 ||
    latitude > 90 ||
    typeof longitude !== "number" ||
    !Number.isFinite(longitude) ||
    longitude < -180 ||
    longitude > 180 ||
    timezone === null
  )
    return null;
  return {
    provider,
    providerPlaceId,
    label,
    formattedAddress,
    address,
    source,
    latitude,
    longitude,
    ...(timezone ? { timezone } : {}),
  };
}

export function parseLocationSearchResponse(
  value: unknown,
): LocationCandidate[] | null {
  const response = record(value);
  if (!response || !Array.isArray(response.candidates)) return null;
  const candidates: LocationCandidate[] = [];
  for (const value of response.candidates) {
    const candidate = parseLocationCandidate(value);
    if (!candidate) return null;
    candidates.push(candidate);
  }
  return candidates;
}
