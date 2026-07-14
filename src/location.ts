import type {
  LocationCandidate,
  LocationDraft,
  LocationSource,
  NormalizedAddress,
  SavedLocation,
} from "./types";

export type LocationRow = {
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  geocoded_location: string | null;
  location_provider: string | null;
  location_provider_id: string | null;
  location_address: unknown;
  location_source: unknown;
  location_confirmed_at: string | null;
};

export type LocationWritePayload = Partial<{
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  geocoded_location: string | null;
  location_provider: string | null;
  location_provider_id: string | null;
  location_address: NormalizedAddress | null;
  location_source: LocationSource | null;
  location_confirmed_at: string | null;
}>;

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

function trimmed(value: string | null | undefined) {
  const normalized = value?.trim();
  return normalized || null;
}

function validCoordinates(latitude: number, longitude: number) {
  return (
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

function normalizedAddress(value: unknown): NormalizedAddress | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const address: NormalizedAddress = {};
  for (const key of addressKeys) {
    const part = record[key];
    if (typeof part === "string" && part.trim()) address[key] = part.trim();
  }
  return Object.keys(address).length ? address : null;
}

function locationSource(value: unknown): LocationSource | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  const record = value as Record<string, unknown>;
  const name = typeof record.name === "string" ? trimmed(record.name) : null;
  const attribution =
    typeof record.attribution === "string"
      ? trimmed(record.attribution)
      : null;
  if (!name || !attribution) return null;
  const license =
    typeof record.license === "string" ? trimmed(record.license) : null;
  const url = typeof record.url === "string" ? trimmed(record.url) : null;
  return {
    name,
    attribution,
    ...(license ? { license } : {}),
    ...(url ? { url } : {}),
  };
}

function assertCandidate(candidate: LocationCandidate) {
  if (!trimmed(candidate.provider))
    throw new Error("A selected location must include its provider.");
  if (!trimmed(candidate.providerPlaceId))
    throw new Error("A selected location must include its provider ID.");
  if (!trimmed(candidate.formattedAddress))
    throw new Error("A selected location must include a formatted address.");
  if (!normalizedAddress(candidate.address))
    throw new Error("A selected location must include a structured address.");
  if (!locationSource(candidate.source))
    throw new Error("A selected location must include source attribution.");
  if (!validCoordinates(candidate.latitude, candidate.longitude))
    throw new Error("A selected location must include valid coordinates.");
}

export function mapSavedLocation(row: LocationRow): SavedLocation {
  const label = row.location ?? "";
  if (!label.trim()) return { kind: "none", label: "" };

  const hasCoordinates =
    row.latitude !== null &&
    row.longitude !== null &&
    validCoordinates(row.latitude, row.longitude);
  const provider = trimmed(row.location_provider);
  const providerPlaceId = trimmed(row.location_provider_id);
  const formattedAddress = trimmed(row.geocoded_location);
  const address = normalizedAddress(row.location_address);
  const source = locationSource(row.location_source);
  const confirmedAt = trimmed(row.location_confirmed_at);

  if (
    confirmedAt &&
    hasCoordinates &&
    provider &&
    providerPlaceId &&
    formattedAddress &&
    address &&
    source
  ) {
    return {
      kind: "confirmed",
      label,
      confirmedAt,
      candidate: {
        provider,
        providerPlaceId,
        label,
        formattedAddress,
        address,
        source,
        latitude: row.latitude as number,
        longitude: row.longitude as number,
        ...(trimmed(row.timezone) ? { timezone: row.timezone!.trim() } : {}),
      },
    };
  }

  if (hasCoordinates) {
    return {
      kind: "legacy",
      label,
      latitude: row.latitude as number,
      longitude: row.longitude as number,
      ...(trimmed(row.timezone) ? { timezone: row.timezone!.trim() } : {}),
      ...(formattedAddress ? { formattedAddress } : {}),
    };
  }

  return { kind: "text", label };
}

const clearedLocationMetadata = {
  latitude: null,
  longitude: null,
  timezone: null,
  geocoded_location: null,
  location_provider: null,
  location_provider_id: null,
  location_address: null,
  location_source: null,
  location_confirmed_at: null,
} as const;

export function buildLocationWritePayload(
  draft: LocationDraft,
  options?: { confirmedAt?: string },
): LocationWritePayload {
  if (draft.intent === "preserve") return {};
  if (draft.intent === "clear")
    return { location: null, ...clearedLocationMetadata };

  const label = trimmed(draft.label);
  if (draft.intent === "text-only")
    return { location: label, ...clearedLocationMetadata };

  if (!label)
    throw new Error("A selected location must include a display label.");
  if (!draft.candidate)
    throw new Error("A selected location must include a candidate.");
  assertCandidate(draft.candidate);
  const confirmedAt = trimmed(options?.confirmedAt);
  if (!confirmedAt)
    throw new Error("A selected location must include a confirmation time.");

  const candidate = draft.candidate;
  return {
    location: label,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    timezone: trimmed(candidate.timezone),
    geocoded_location: candidate.formattedAddress.trim(),
    location_provider: candidate.provider.trim(),
    location_provider_id: candidate.providerPlaceId.trim(),
    location_address: normalizedAddress(candidate.address),
    location_source: locationSource(candidate.source),
    location_confirmed_at: confirmedAt,
  };
}

/**
 * Bridges the current text-only forms to the explicit Phase 4 contract.
 * Existing records preserve geographic metadata when the final submitted label
 * is unchanged. A changed non-empty label becomes text-only, and an empty label
 * clears every location field. New records never interpret raw text as a
 * confirmed location. Once a form supplies an explicit draft, that intent wins.
 */
export function locationDraftForPersistence(
  label: string,
  explicitDraft?: LocationDraft,
  previous?: SavedLocation,
): LocationDraft {
  if (explicitDraft && (explicitDraft.intent !== "preserve" || previous))
    return explicitDraft;

  const nextLabel = label.trim();
  if (previous && nextLabel === previous.label.trim()) {
    return { label: nextLabel, intent: "preserve" };
  }
  return nextLabel
    ? { label: nextLabel, intent: "text-only" }
    : { label: "", intent: "clear" };
}
