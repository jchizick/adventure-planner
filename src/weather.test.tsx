// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Adventure, LocationCandidate, SavedLocation } from "./types";

const mocks = vi.hoisted(() => ({ invoke: vi.fn() }));

vi.mock("./lib/supabase", () => ({
  supabase: { functions: { invoke: mocks.invoke } },
}));

import { WeatherIndicator } from "./weather";

const candidate: LocationCandidate = {
  provider: "geoapify",
  providerPlaceId: "toronto",
  label: "Toronto, ON, Canada",
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

const confirmedLocation: SavedLocation = {
  kind: "confirmed",
  label: candidate.label,
  candidate,
  confirmedAt: "2026-07-15T12:00:00.000Z",
};

function adventure(overrides: Partial<Adventure> = {}): Adventure {
  return {
    id: "adventure-id",
    title: "Weather check",
    description: "",
    date: "2026-07-20",
    startTime: "10:00 AM",
    endTime: "",
    status: "Confirmed",
    location: "Location to be decided",
    savedLocation: { kind: "none", label: "" },
    stops: [],
    notes: "",
    links: [],
    checklist: [],
    addedBy: "Member",
    updatedBy: "Member",
    completed: false,
    favorite: false,
    ...overrides,
    tags: overrides.tags ?? [],
  };
}

function confirmedAdventure(overrides: Partial<Adventure> = {}) {
  return adventure({
    location: candidate.label,
    savedLocation: confirmedLocation,
    latitude: candidate.latitude,
    longitude: candidate.longitude,
    timezone: candidate.timezone,
    ...overrides,
  });
}

afterEach(() => {
  cleanup();
  mocks.invoke.mockReset();
});

describe("WeatherIndicator location eligibility", () => {
  it.each([
    ["text-only", { kind: "text", label: "West entrance" } as SavedLocation],
    [
      "legacy",
      {
        kind: "legacy",
        label: "Toronto",
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        timezone: candidate.timezone,
      } as SavedLocation,
    ],
  ])("prompts editable %s locations to use explicit selection", (_name, savedLocation) => {
    const onEdit = vi.fn();
    render(
      <WeatherIndicator
        adventure={adventure({
          location: savedLocation.label,
          savedLocation,
          ...(savedLocation.kind === "legacy"
            ? {
                latitude: savedLocation.latitude,
                longitude: savedLocation.longitude,
                timezone: savedLocation.timezone,
              }
            : {}),
        })}
        canEdit
        onEdit={onEdit}
      />,
    );

    fireEvent.click(
      screen.getByRole("button", { name: "Select location for weather" }),
    );
    expect(onEdit).toHaveBeenCalledOnce();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("keeps the empty-location edit action", () => {
    const onEdit = vi.fn();
    render(
      <WeatherIndicator
        adventure={adventure()}
        canEdit
        onEdit={onEdit}
      />,
    );
    fireEvent.click(
      screen.getByRole("button", { name: "Add location for weather" }),
    );
    expect(onEdit).toHaveBeenCalledOnce();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it.each([
    ["text-only", { kind: "text", label: "West entrance" } as SavedLocation],
    [
      "legacy",
      {
        kind: "legacy",
        label: "Toronto",
        latitude: candidate.latitude,
        longitude: candidate.longitude,
        timezone: candidate.timezone,
      } as SavedLocation,
    ],
  ])("keeps %s setup read-only for non-editors", (_name, savedLocation) => {
    render(
      <WeatherIndicator
        adventure={adventure({
          location: savedLocation.label,
          savedLocation,
        })}
        canEdit={false}
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText("Weather needs a confirmed location")).toBeTruthy();
    expect(
      screen.queryByRole("button", { name: "Select location for weather" }),
    ).toBeNull();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });
});

describe("WeatherIndicator confirmed-location behavior", () => {
  it.each([
    [
      "forecast",
      {
        status: "forecast",
        weatherCode: 0,
        temperatureC: 22,
        apparentTemperatureC: 22,
        precipitationProbability: 10,
        windSpeedKph: 8,
        label: "Clear sky",
        sourceTime: "2026-07-20T10:00",
        updatedAt: "2026-07-15T12:00:00.000Z",
      },
      "View weather forecast",
    ],
    [
      "historical",
      {
        status: "historical",
        weatherCode: 3,
        temperatureC: 18,
        apparentTemperatureC: 17,
        precipitationMm: 0,
        windSpeedKph: 6,
        label: "Overcast",
        sourceTime: "2026-07-10T10:00",
        updatedAt: "2026-07-15T12:00:00.000Z",
      },
      "View historical weather",
    ],
  ])("retains %s responses", async (_name, response, accessibleName) => {
    mocks.invoke.mockResolvedValue({ data: response, error: null });
    render(
      <WeatherIndicator
        adventure={confirmedAdventure()}
        canEdit
        onEdit={vi.fn()}
      />,
    );
    expect(
      await screen.findByRole("button", { name: accessibleName }),
    ).toBeTruthy();
    expect(mocks.invoke).toHaveBeenCalledWith("weather-for-adventure", {
      body: { adventureId: "adventure-id" },
      signal: expect.any(AbortSignal),
    });
  });

  it("retains missing-time and missing-timezone setup states", () => {
    const { rerender } = render(
      <WeatherIndicator
        adventure={confirmedAdventure({ startTime: "" })}
        canEdit
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText("Add time for weather")).toBeTruthy();
    expect(mocks.invoke).not.toHaveBeenCalled();

    rerender(
      <WeatherIndicator
        adventure={confirmedAdventure({ timezone: undefined })}
        canEdit
        onEdit={vi.fn()}
      />,
    );
    expect(screen.getByText("Select location for weather")).toBeTruthy();
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it.each([
    ["provider-unavailable", "Weather temporarily unavailable"],
    ["invalid-timezone", "Weather unavailable"],
    ["no-hourly-match", "Weather unavailable"],
    ["unavailable", "Weather unavailable"],
  ])("retains the %s response", async (status, label) => {
    mocks.invoke.mockResolvedValue({ data: { status }, error: null });
    render(
      <WeatherIndicator
        adventure={confirmedAdventure()}
        canEdit
        onEdit={vi.fn()}
      />,
    );
    expect(await screen.findByRole("button", { name: label })).toBeTruthy();
  });

  it("retains the too-early response", async () => {
    mocks.invoke.mockResolvedValue({
      data: { status: "too-early", availableFrom: "2026-08-01" },
      error: null,
    });
    render(
      <WeatherIndicator
        adventure={confirmedAdventure()}
        canEdit
        onEdit={vi.fn()}
      />,
    );
    expect(await screen.findByText("Weather closer to date")).toBeTruthy();
  });
});
