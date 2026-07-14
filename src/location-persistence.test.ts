import { describe, expect, it, vi } from "vitest";
import adventuresSource from "./repositories/adventures.ts?raw";

vi.mock("./lib/supabase", () => ({
  supabase: {},
}));
vi.mock("./repositories/geocoding", () => ({
  geocodeAdventureLocation: vi.fn(),
}));

import {
  adventureColumns,
  adventureLocationPayload,
  mapAdventure,
  promotionLocationRpcPayload,
  type AdventureRow,
} from "./repositories/adventures";
import {
  mapStop,
  stopColumns,
  stopLocationPayload,
  type StopRow,
} from "./repositories/adventure-stops";
import type { LocationCandidate, SavedLocation } from "./types";

const confirmedAt = "2026-07-14T19:00:00.000Z";
const candidate: LocationCandidate = {
  provider: "geoapify",
  providerPlaceId: "place-toronto",
  label: "Toronto",
  formattedAddress: "Toronto, Ontario, Canada",
  address: { city: "Toronto", region: "Ontario", country: "Canada" },
  source: {
    name: "openstreetmap",
    attribution: "© OpenStreetMap contributors",
  },
  latitude: 43.6532,
  longitude: -79.3832,
  timezone: "America/Toronto",
};
const selectedLocationColumns = [
  "location",
  "latitude",
  "longitude",
  "timezone",
  "geocoded_location",
  "location_provider",
  "location_provider_id",
  "location_address",
  "location_source",
  "location_confirmed_at",
];

function adventureRow(
  overrides: Partial<AdventureRow> = {},
): AdventureRow {
  return {
    id: "adventure-id",
    space_id: "space-id",
    source_idea_id: null,
    title: "Toronto day",
    description: null,
    category: "culture",
    status: "tentative",
    event_date: "2026-08-01",
    start_time: "10:00:00",
    end_time: null,
    location: null,
    latitude: null,
    longitude: null,
    timezone: null,
    geocoded_location: null,
    location_provider: null,
    location_provider_id: null,
    location_address: null,
    location_source: null,
    location_confirmed_at: null,
    notes: null,
    cover_image_url: null,
    cover_variant: null,
    is_favorite: false,
    completed_at: null,
    created_by: "user-id",
    updated_by: "user-id",
    created_at: confirmedAt,
    updated_at: confirmedAt,
    ...overrides,
  };
}

function stopRow(overrides: Partial<StopRow> = {}): StopRow {
  return {
    id: "stop-id",
    adventure_id: "adventure-id",
    title: "Lunch",
    location: null,
    latitude: null,
    longitude: null,
    timezone: null,
    geocoded_location: null,
    location_provider: null,
    location_provider_id: null,
    location_address: null,
    location_source: null,
    location_confirmed_at: null,
    start_time: null,
    end_time: null,
    notes: null,
    sort_order: 1,
    travel_time_minutes: null,
    ...overrides,
  };
}

function confirmedFields() {
  return {
    location: candidate.label,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    timezone: candidate.timezone ?? null,
    geocoded_location: candidate.formattedAddress,
    location_provider: candidate.provider,
    location_provider_id: candidate.providerPlaceId,
    location_address: candidate.address,
    location_source: candidate.source,
    location_confirmed_at: confirmedAt,
  };
}

describe("Adventure location persistence", () => {
  it("selects every location field consumed by the Adventure mapper", () => {
    for (const column of selectedLocationColumns)
      expect(adventureColumns).toContain(column);
  });

  it.each([
    ["none", adventureRow(), "none"],
    ["text", adventureRow({ location: "Meet at the west entrance" }), "text"],
    [
      "legacy",
      adventureRow({
        location: "Toronto",
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        timezone: candidate.timezone ?? null,
      }),
      "legacy",
    ],
    ["confirmed", adventureRow(confirmedFields()), "confirmed"],
    [
      "incomplete confirmation",
      adventureRow({
        ...confirmedFields(),
        location_source: null,
      }),
      "legacy",
    ],
  ])("maps %s rows correctly", (_name, row, kind) => {
    expect(mapAdventure(row).savedLocation.kind).toBe(kind);
  });

  const legacy: SavedLocation = {
    kind: "legacy",
    label: "Toronto",
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    timezone: candidate.timezone,
  };

  it("preserves legacy coordinates for an unrelated current-UI edit", () => {
    expect(adventureLocationPayload({ location: "Toronto" }, legacy)).toEqual(
      {},
    );
  });

  it("writes every field for an explicitly selected candidate", () => {
    expect(
      adventureLocationPayload(
        {
          location: "Toronto",
          locationDraft: {
            label: "Toronto",
            intent: "selected",
            candidate,
          },
        },
        legacy,
        confirmedAt,
      ),
    ).toMatchObject(confirmedFields());
  });

  it("turns changed current-UI text into text-only and clears stale metadata", () => {
    expect(
      adventureLocationPayload(
        { location: "Meet at the west entrance" },
        legacy,
      ),
    ).toEqual({
      location: "Meet at the west entrance",
      latitude: null,
      longitude: null,
      timezone: null,
      geocoded_location: null,
      location_provider: null,
      location_provider_id: null,
      location_address: null,
      location_source: null,
      location_confirmed_at: null,
    });
  });

  it("clears the label and all metadata", () => {
    expect(adventureLocationPayload({ location: "" }, legacy)).toEqual({
      location: null,
      latitude: null,
      longitude: null,
      timezone: null,
      geocoded_location: null,
      location_provider: null,
      location_provider_id: null,
      location_address: null,
      location_source: null,
      location_confirmed_at: null,
    });
  });

  it("promotes current Idea text without coordinates", () => {
    expect(
      promotionLocationRpcPayload({ location: "Toronto" }, confirmedAt),
    ).toEqual({
      p_location: "Toronto",
      p_latitude: null,
      p_longitude: null,
      p_timezone: null,
      p_geocoded_location: null,
      p_location_provider: null,
      p_location_provider_id: null,
      p_location_address: null,
      p_location_source: null,
      p_location_confirmed_at: null,
    });
  });

  it("keeps table-column and promotion-RPC payload keys distinct", () => {
    expect(adventureLocationPayload({ location: "Toronto" })).toHaveProperty(
      "location",
    );
    expect(adventureLocationPayload({ location: "Toronto" })).not.toHaveProperty(
      "p_location",
    );
    expect(promotionLocationRpcPayload({ location: "Toronto" })).toHaveProperty(
      "p_location",
    );
    expect(
      promotionLocationRpcPayload({ location: "Toronto" }),
    ).not.toHaveProperty("location");
  });

  it("promotes a confirmed candidate atomically", () => {
    expect(
      promotionLocationRpcPayload(
        {
          location: "Toronto",
          locationDraft: {
            label: "Toronto",
            intent: "selected",
            candidate,
          },
        },
        confirmedAt,
      ),
    ).toMatchObject({
      p_location: "Toronto",
      p_latitude: candidate.latitude,
      p_longitude: candidate.longitude,
      p_timezone: candidate.timezone,
      p_location_provider: candidate.provider,
      p_location_confirmed_at: confirmedAt,
    });
  });

  it("accepts a selected candidate without a timezone", () => {
    const withoutTimezone = { ...candidate, timezone: undefined };
    expect(
      adventureLocationPayload(
        {
          location: "Toronto",
          locationDraft: {
            label: "Toronto",
            intent: "selected",
            candidate: withoutTimezone,
          },
        },
        undefined,
        confirmedAt,
      ),
    ).toMatchObject({ timezone: null, location_confirmed_at: confirmedAt });
  });
});

describe("stop location persistence", () => {
  it("selects every location field consumed by the stop mapper", () => {
    for (const column of selectedLocationColumns)
      expect(stopColumns).toContain(column);
  });

  it.each([
    ["none", stopRow(), "none"],
    ["text", stopRow({ location: "Front doors" }), "text"],
    ["confirmed", stopRow(confirmedFields()), "confirmed"],
  ])("maps %s rows correctly", (_name, row, kind) => {
    expect(mapStop(row).savedLocation.kind).toBe(kind);
  });

  const confirmed = mapStop(stopRow(confirmedFields())).savedLocation;

  it("supports preserve, selected, text-only, and clear transitions", () => {
    expect(stopLocationPayload({ location: "Toronto" }, confirmed)).toEqual(
      {},
    );
    expect(
      stopLocationPayload(
        {
          location: "Toronto",
          locationDraft: {
            label: "Toronto",
            intent: "selected",
            candidate,
          },
        },
        confirmed,
        confirmedAt,
      ),
    ).toMatchObject(confirmedFields());
    expect(
      stopLocationPayload({ location: "Front doors" }, confirmed),
    ).toMatchObject({ location: "Front doors", latitude: null });
    expect(stopLocationPayload({ location: "" }, confirmed)).toMatchObject({
      location: null,
      latitude: null,
      location_provider: null,
    });
  });
});

describe("save-time geocoding boundary", () => {
  it("keeps the legacy geocoder only in the explicit weather-enablement path", () => {
    expect(adventuresSource.match(/geocodeAdventureLocation\(/g)).toHaveLength(1);
    const enableStart = adventuresSource.indexOf(
      "export async function enableAdventureWeather",
    );
    const duplicateStart = adventuresSource.indexOf(
      "export async function duplicateAdventure",
    );
    expect(adventuresSource.slice(enableStart, duplicateStart)).toContain(
      "geocodeAdventureLocation(",
    );
  });
});
