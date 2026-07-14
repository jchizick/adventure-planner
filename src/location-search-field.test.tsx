// @vitest-environment jsdom

import { useState } from "react";
import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { Sheet } from "./components";
import { initialLocationDraft } from "./location-field-state";
import {
  LocationSearchField,
  type LocationSearchFieldProps,
} from "./location-search-field";
import type { LocationCandidate, LocationDraft, SavedLocation } from "./types";

const toronto: LocationCandidate = {
  provider: "geoapify",
  providerPlaceId: "toronto",
  label: "Toronto, Ontario",
  formattedAddress: "Toronto, Ontario, Canada",
  address: { city: "Toronto", region: "Ontario", country: "Canada" },
  source: {
    name: "openstreetmap",
    attribution: "© OpenStreetMap contributors",
  },
  latitude: 43.6532,
  longitude: -79.3832,
};

const torontoStreet: LocationCandidate = {
  ...toronto,
  providerPlaceId: "toronto-street",
  label: "Toronto Street",
  formattedAddress: "Toronto Street, Toronto, Ontario, Canada",
  address: {
    name: "Toronto Street",
    city: "Toronto",
    region: "Ontario",
    country: "Canada",
  },
};

type SearchLocations = NonNullable<LocationSearchFieldProps["searchLocations"]>;

function Harness({
  initialSaved = { kind: "none", label: "" },
  initialDraft,
  searchLocations,
  onDraft,
}: {
  initialSaved?: SavedLocation;
  initialDraft?: LocationDraft;
  searchLocations: SearchLocations;
  onDraft?: (draft: LocationDraft) => void;
}) {
  const [draft, setDraft] = useState(
    initialDraft ?? initialLocationDraft(initialSaved),
  );
  return (
    <LocationSearchField
      id="test-location"
      spaceId="space-id"
      savedLocation={initialSaved}
      draft={draft}
      onChange={(next) => {
        setDraft(next);
        onDraft?.(next);
      }}
      textOnlyWarning="Saved as text only. Select a result to show it on the map."
      searchLocations={searchLocations}
    />
  );
}

beforeAll(() => {
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("LocationSearchField", () => {
  it("does not search initially or below three trimmed characters", () => {
    vi.useFakeTimers();
    const searchLocations = vi.fn<SearchLocations>();
    render(<Harness searchLocations={searchLocations} />);
    const input = screen.getByRole("combobox", { name: "Location" });
    fireEvent.change(input, { target: { value: "To" } });
    act(() => vi.advanceTimersByTime(500));
    expect(searchLocations).not.toHaveBeenCalled();
    expect(
      screen.getByText(/Saved as text only/, { selector: "p" }),
    ).toBeTruthy();
  });

  it("debounces, aborts superseded work, and ignores stale results", async () => {
    vi.useFakeTimers();
    let resolveFirst!: (value: LocationCandidate[]) => void;
    let firstSignal: AbortSignal | undefined;
    const searchLocations = vi
      .fn<SearchLocations>()
      .mockImplementationOnce((_request, options) => {
        firstSignal = options?.signal;
        return new Promise((resolve) => {
          resolveFirst = resolve;
        });
      })
      .mockResolvedValueOnce([torontoStreet]);
    render(<Harness searchLocations={searchLocations} />);
    const input = screen.getByRole("combobox", { name: "Location" });

    fireEvent.change(input, { target: { value: "Toronto" } });
    act(() => vi.advanceTimersByTime(299));
    expect(searchLocations).not.toHaveBeenCalled();
    await act(async () => vi.advanceTimersByTime(1));
    expect(searchLocations).toHaveBeenCalledTimes(1);
    expect(screen.getByText("Searching locations…")).toBeTruthy();

    fireEvent.change(input, { target: { value: "Toronto Street" } });
    expect(firstSignal?.aborted).toBe(true);
    await act(async () => vi.advanceTimersByTime(300));
    expect(searchLocations).toHaveBeenCalledTimes(2);
    expect(screen.getByText(torontoStreet.formattedAddress)).toBeTruthy();

    await act(async () => resolveFirst([toronto]));
    expect(screen.queryByText(toronto.formattedAddress)).toBeNull();
    expect(screen.getByText(torontoStreet.formattedAddress)).toBeTruthy();
  });

  it("preserves provider order and selects the active candidate with the keyboard", async () => {
    vi.useFakeTimers();
    const onDraft = vi.fn();
    const searchLocations = vi
      .fn<SearchLocations>()
      .mockResolvedValue([torontoStreet, toronto]);
    render(<Harness searchLocations={searchLocations} onDraft={onDraft} />);
    const input = screen.getByRole("combobox", { name: "Location" });
    fireEvent.change(input, { target: { value: "Toronto" } });
    await act(async () => vi.advanceTimersByTime(300));

    const options = screen.getAllByRole("option");
    expect(options.map((option) => option.textContent)).toEqual([
      "Toronto StreetToronto Street, Toronto, Ontario, Canada",
      "Toronto, OntarioToronto, Ontario, Canada",
    ]);
    expect(input.getAttribute("aria-activedescendant")).toContain("option-0");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(input.getAttribute("aria-activedescendant")).toContain("option-1");
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onDraft).toHaveBeenLastCalledWith({
      label: toronto.label,
      intent: "selected",
      candidate: toronto,
    });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(screen.getByText("Confirmed location")).toBeTruthy();
  });

  it("shows empty and recoverable error states and retries", async () => {
    vi.useFakeTimers();
    const searchLocations = vi
      .fn<SearchLocations>()
      .mockResolvedValueOnce([])
      .mockRejectedValueOnce(new Error("provider unavailable"))
      .mockResolvedValueOnce([toronto]);
    render(<Harness searchLocations={searchLocations} />);
    const input = screen.getByRole("combobox", { name: "Location" });

    fireEvent.change(input, { target: { value: "Nowhere" } });
    await act(async () => vi.advanceTimersByTime(300));
    expect(screen.getByText(/No matching locations/)).toBeTruthy();

    fireEvent.change(input, { target: { value: "Toronto" } });
    await act(async () => vi.advanceTimersByTime(300));
    expect(
      screen.getByText("Location search is temporarily unavailable.", {
        selector: ".location-search-error span",
      }),
    ).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    await act(async () => vi.advanceTimersByTime(300));
    expect(screen.getByRole("option")).toBeTruthy();
    expect(searchLocations).toHaveBeenCalledTimes(3);
  });

  it("closes results with Escape without closing the containing Sheet", async () => {
    vi.useFakeTimers();
    const onClose = vi.fn();
    const searchLocations = vi
      .fn<SearchLocations>()
      .mockResolvedValue([toronto]);
    render(
      <Sheet open title="Edit adventure" onClose={onClose}>
        <Harness searchLocations={searchLocations} />
      </Sheet>,
    );
    const input = screen.getByRole("combobox", { name: "Location" });
    fireEvent.change(input, { target: { value: "Toronto" } });
    await act(async () => vi.advanceTimersByTime(300));
    expect(screen.getByRole("listbox")).toBeTruthy();
    fireEvent.keyDown(input, { key: "Escape" });
    expect(screen.queryByRole("listbox")).toBeNull();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("invalidates a confirmed value on edit and accepts a candidate without timezone", async () => {
    vi.useFakeTimers();
    const confirmed: SavedLocation = {
      kind: "confirmed",
      label: toronto.label,
      candidate: toronto,
      confirmedAt: "2026-07-14T20:00:00.000Z",
    };
    const onDraft = vi.fn();
    const searchLocations = vi
      .fn<SearchLocations>()
      .mockResolvedValue([{ ...toronto, timezone: undefined }]);
    render(
      <Harness
        initialSaved={confirmed}
        searchLocations={searchLocations}
        onDraft={onDraft}
      />,
    );
    expect(screen.getByText("Confirmed location")).toBeTruthy();
    expect(searchLocations).not.toHaveBeenCalled();
    const input = screen.getByRole("combobox", { name: "Location" });
    fireEvent.change(input, { target: { value: "Toronto edited" } });
    expect(onDraft).toHaveBeenLastCalledWith({
      label: "Toronto edited",
      intent: "text-only",
    });
    expect(screen.queryByText("Confirmed location")).toBeNull();
    await act(async () => vi.advanceTimersByTime(300));
    fireEvent.click(screen.getByRole("option"));
    expect(onDraft.mock.lastCall?.[0]).toMatchObject({ intent: "selected" });
    expect(onDraft.mock.lastCall?.[0].candidate.timezone).toBeUndefined();
  });
});
