import { describe, expect, it, vi } from "vitest";

vi.mock("../lib/supabase", () => ({
  supabase: { functions: { invoke: vi.fn() } },
}));

import {
  createLocationCandidateSearch,
  LocationSearchError,
  type LocationSearchInvoker,
} from "./location-search";

const candidate = {
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

describe("location candidate search repository", () => {
  it("validates unknown responses and returns provider-neutral candidates", async () => {
    const invoker = vi.fn<LocationSearchInvoker>().mockResolvedValue({
      data: { candidates: [candidate] },
      error: null,
    });
    const search = createLocationCandidateSearch(invoker);
    await expect(
      search({ spaceId: "space-id", query: "Toronto, Ontario" }),
    ).resolves.toEqual([candidate]);
  });

  it.each([
    null,
    {},
    { candidates: null },
    { candidates: [{ ...candidate, latitude: 143 }] },
    { candidates: [{ ...candidate, address: "Toronto" }] },
    { candidates: [{ ...candidate, source: { name: "openstreetmap" } }] },
  ])("rejects a malformed runtime response %#", async (data) => {
    const search = createLocationCandidateSearch(async () => ({
      data,
      error: null,
    }));
    await expect(
      search({ spaceId: "space-id", query: "Toronto, Ontario" }),
    ).rejects.toBeInstanceOf(LocationSearchError);
  });

  it("passes the request and AbortSignal to the invocation boundary", async () => {
    const controller = new AbortController();
    const invoker = vi.fn<LocationSearchInvoker>().mockResolvedValue({
      data: { candidates: [] },
      error: null,
    });
    const search = createLocationCandidateSearch(invoker);
    const request = {
      spaceId: "space-id",
      query: "Paris",
      adventureId: "adventure-id",
    };
    await search(request, { signal: controller.signal });
    expect(invoker).toHaveBeenCalledWith(request, controller.signal);
  });

  it("rejects with AbortError when cancellation occurs", async () => {
    const controller = new AbortController();
    const search = createLocationCandidateSearch(
      (_request, signal) =>
        new Promise((resolve) => {
          signal?.addEventListener(
            "abort",
            () => resolve({ data: { candidates: [] }, error: null }),
            { once: true },
          );
        }),
    );
    const pending = search(
      { spaceId: "space-id", query: "Toronto, Ontario" },
      { signal: controller.signal },
    );
    controller.abort();
    await expect(pending).rejects.toMatchObject({ name: "AbortError" });
  });

  it("does not invoke after an already-aborted request", async () => {
    const controller = new AbortController();
    controller.abort();
    const invoker = vi.fn<LocationSearchInvoker>();
    const search = createLocationCandidateSearch(invoker);
    await expect(
      search(
        { spaceId: "space-id", query: "Toronto, Ontario" },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(invoker).not.toHaveBeenCalled();
  });
});
