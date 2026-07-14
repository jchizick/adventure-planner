import { describe, expect, it } from "vitest";
import {
  buildGeoapifyAutocompleteUrl,
  GEOAPIFY_AUTOCOMPLETE_URL,
  MalformedGeoapifyResponseError,
  normalizeGeoapifyResponse,
} from "../supabase/functions/search-locations/geoapify";

function result(overrides: Record<string, unknown> = {}) {
  return {
    place_id: "place-toronto",
    name: "Toronto",
    formatted: "Toronto, Ontario, Canada",
    address_line1: "Toronto",
    address_line2: "Ontario, Canada",
    city: "Toronto",
    state: "Ontario",
    state_code: "ON",
    country: "Canada",
    country_code: "ca",
    lat: 43.6532,
    lon: -79.3832,
    timezone: { name: "America/Toronto" },
    datasource: {
      sourcename: "openstreetmap",
      attribution: "© OpenStreetMap contributors",
      license: "Open Database License",
      url: "https://www.openstreetmap.org/copyright",
    },
    ...overrides,
  };
}

describe("normalizeGeoapifyResponse", () => {
  it("normalizes a valid provider candidate", () => {
    expect(normalizeGeoapifyResponse({ results: [result()] })).toEqual([
      {
        provider: "geoapify",
        providerPlaceId: "place-toronto",
        label: "Toronto",
        formattedAddress: "Toronto, Ontario, Canada",
        address: {
          name: "Toronto",
          addressLine1: "Toronto",
          addressLine2: "Ontario, Canada",
          city: "Toronto",
          region: "Ontario",
          regionCode: "ON",
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
      },
    ]);
  });

  it("rejects a malformed provider response", () => {
    expect(() => normalizeGeoapifyResponse({ features: [] })).toThrow(
      MalformedGeoapifyResponseError,
    );
  });

  it("rejects candidates without a valid provider ID", () => {
    expect(
      normalizeGeoapifyResponse({ results: [result({ place_id: " " })] }),
    ).toEqual([]);
  });

  it("rejects candidates with invalid coordinate ranges", () => {
    expect(
      normalizeGeoapifyResponse({
        results: [result({ lat: 91 }), result({ lon: -181 })],
      }),
    ).toEqual([]);
  });

  it("rejects malformed structured addresses and source objects", () => {
    const noAddress = result({
      name: undefined,
      address_line1: undefined,
      address_line2: undefined,
      city: undefined,
      state: undefined,
      state_code: undefined,
      country: undefined,
      country_code: undefined,
    });
    expect(
      normalizeGeoapifyResponse({
        results: [noAddress, result({ datasource: [] })],
      }),
    ).toEqual([]);
  });

  it("removes duplicate provider IDs stably and preserves provider order", () => {
    const candidates = normalizeGeoapifyResponse({
      results: [
        result({ place_id: "first", name: "First" }),
        result({ place_id: "second", name: "Second" }),
        result({ place_id: "first", name: "Duplicate first" }),
        result({ place_id: "third", name: "Third" }),
      ],
    });
    expect(candidates.map(({ providerPlaceId }) => providerPlaceId)).toEqual([
      "first",
      "second",
      "third",
    ]);
    expect(candidates[0].label).toBe("First");
  });

  it("keeps ambiguous Toronto, Ontario results as multiple candidates", () => {
    const candidates = normalizeGeoapifyResponse({
      results: [
        result({ place_id: "toronto-city", name: "Toronto" }),
        result({
          place_id: "toronto-township",
          name: "Toronto Township",
          formatted: "Toronto Township, Ontario, Canada",
        }),
      ],
    });
    expect(candidates).toHaveLength(2);
    expect(candidates.map(({ providerPlaceId }) => providerPlaceId)).toEqual([
      "toronto-city",
      "toronto-township",
    ]);
  });

  it("returns an empty candidate list for a valid no-result response", () => {
    expect(normalizeGeoapifyResponse({ results: [] })).toEqual([]);
  });
});

describe("buildGeoapifyAutocompleteUrl", () => {
  it("builds one global six-result autocomplete request without restrictions", () => {
    const url = buildGeoapifyAutocompleteUrl(
      "Paris",
      "server-secret",
    );
    expect(url.origin + url.pathname).toBe(GEOAPIFY_AUTOCOMPLETE_URL);
    expect(url.searchParams.get("text")).toBe("Paris");
    expect(url.searchParams.get("limit")).toBe("6");
    expect(url.searchParams.get("format")).toBe("json");
    expect(url.searchParams.get("bias")).toBe("countrycode:none");
    expect(url.searchParams.has("filter")).toBe(false);
    expect(url.toString().toLowerCase()).not.toContain("canada");
    expect(url.toString().toLowerCase()).not.toContain("toronto");
  });

  it("adds optional Adventure-coordinate proximity bias without filtering", () => {
    const url = buildGeoapifyAutocompleteUrl("Coffee", "server-secret", {
      latitude: 43.6532,
      longitude: -79.3832,
    });
    expect(url.searchParams.get("bias")).toBe(
      "proximity:-79.3832,43.6532|countrycode:none",
    );
    expect(url.searchParams.has("filter")).toBe(false);
  });
});
