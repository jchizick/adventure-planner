import { describe, expect, it } from "vitest";
import {
  buildLocationWritePayload,
  mapSavedLocation,
  type LocationRow,
} from "./location";
import type { LocationCandidate } from "./types";

const emptyRow: LocationRow = {
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
};

const candidate: LocationCandidate = {
  provider: "geoapify",
  providerPlaceId: "place-toronto",
  label: "Toronto, Ontario",
  formattedAddress: "Toronto, Ontario, Canada",
  address: {
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
    countryCode: "ca",
  },
  source: {
    name: "openstreetmap",
    attribution: "© OpenStreetMap contributors",
    license: "Open Database License",
    url: "https://www.openstreetmap.org/copyright",
  },
  latitude: 43.6532,
  longitude: -79.3832,
  timezone: "America/Toronto",
};

describe("mapSavedLocation", () => {
  it("maps a missing location to none", () => {
    expect(mapSavedLocation(emptyRow)).toEqual({ kind: "none", label: "" });
  });

  it("maps a label without coordinates to text", () => {
    expect(
      mapSavedLocation({ ...emptyRow, location: "Meet by the west entrance" }),
    ).toEqual({ kind: "text", label: "Meet by the west entrance" });
  });

  it("maps unconfirmed Adventure coordinates to legacy", () => {
    expect(
      mapSavedLocation({
        ...emptyRow,
        location: "Toronto, Ontario",
        latitude: 43.6532,
        longitude: -79.3832,
        timezone: "America/Toronto",
        geocoded_location: "Toronto, Ontario, Canada",
      }),
    ).toEqual({
      kind: "legacy",
      label: "Toronto, Ontario",
      latitude: 43.6532,
      longitude: -79.3832,
      timezone: "America/Toronto",
      formattedAddress: "Toronto, Ontario, Canada",
    });
  });

  it("maps a complete explicitly selected row to confirmed", () => {
    expect(
      mapSavedLocation({
        ...emptyRow,
        location: "Toronto, Ontario",
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        timezone: candidate.timezone ?? null,
        geocoded_location: candidate.formattedAddress,
        location_provider: candidate.provider,
        location_provider_id: candidate.providerPlaceId,
        location_address: candidate.address,
        location_source: candidate.source,
        location_confirmed_at: "2026-07-14T15:00:00.000Z",
      }),
    ).toEqual({
      kind: "confirmed",
      label: "Toronto, Ontario",
      candidate,
      confirmedAt: "2026-07-14T15:00:00.000Z",
    });
  });

  it("does not classify incomplete confirmation metadata as confirmed", () => {
    expect(
      mapSavedLocation({
        ...emptyRow,
        location: "Toronto, Ontario",
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        location_confirmed_at: "2026-07-14T15:00:00.000Z",
      }).kind,
    ).toBe("legacy");
  });
});

describe("buildLocationWritePayload", () => {
  it("preserves all stored location fields by omitting them", () => {
    expect(
      buildLocationWritePayload({
        label: "Toronto, Ontario",
        intent: "preserve",
      }),
    ).toEqual({});
  });

  it("writes a selected candidate as a complete confirmed payload", () => {
    expect(
      buildLocationWritePayload(
        {
          label: "  Toronto, Ontario  ",
          intent: "selected",
          candidate,
        },
        { confirmedAt: "2026-07-14T15:00:00.000Z" },
      ),
    ).toEqual({
      location: "Toronto, Ontario",
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      timezone: "America/Toronto",
      geocoded_location: candidate.formattedAddress,
      location_provider: candidate.provider,
      location_provider_id: candidate.providerPlaceId,
      location_address: candidate.address,
      location_source: candidate.source,
      location_confirmed_at: "2026-07-14T15:00:00.000Z",
    });
  });

  it("writes text-only and clears every stale metadata field", () => {
    expect(
      buildLocationWritePayload({
        label: "  Meet by the west entrance  ",
        intent: "text-only",
      }),
    ).toEqual({
      location: "Meet by the west entrance",
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

  it("clears both the label and all stored metadata", () => {
    expect(
      buildLocationWritePayload({ label: "ignored", intent: "clear" }),
    ).toEqual({
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

  it("rejects a selected transition without valid confirmation metadata", () => {
    expect(() =>
      buildLocationWritePayload(
        {
          label: "Toronto, Ontario",
          intent: "selected",
          candidate: { ...candidate, latitude: 143 },
        },
        { confirmedAt: "2026-07-14T15:00:00.000Z" },
      ),
    ).toThrow("valid coordinates");
  });
});
