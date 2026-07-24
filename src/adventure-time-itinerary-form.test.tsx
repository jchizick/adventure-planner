// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import type { AdventurePlanInput, AdventureStop } from "./types";

const mocks = vi.hoisted(() => ({
  useWorkspace: vi.fn(() => ({
    activeSpace: { id: "space-id", name: "Our Adventures" },
  })),
}));

vi.mock("./workspace", () => ({ useWorkspace: mocks.useWorkspace }));
vi.mock("./location-search-field", () => ({
  LocationSearchField: () => <div data-testid="location-field" />,
}));

import { AdventureFormSheet, StopEditorSheet } from "./pages";

beforeAll(() => {
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
});

afterEach(cleanup);

const plan = (
  overrides: Partial<AdventurePlanInput> = {},
): AdventurePlanInput => ({
  title: "Sunday market",
  description: "",
  date: "2026-07-26",
  endDate: "",
  startTime: "11:30",
  endTime: "",
  status: "Confirmed",
  location: "",
  notes: "",
  category: "culture",
  ...overrides,
});

const stop = (overrides: Partial<AdventureStop> = {}): AdventureStop => ({
  id: "stop-id",
  title: "Lunch",
  dayDate: "2026-07-27",
  location: "Queen Street",
  savedLocation: { kind: "text", label: "Queen Street" },
  startTime: "12:00 PM",
  endTime: "1:00 PM",
  notes: "Window table",
  optionalTravelTime: "15 min",
  sortOrder: 1,
  ...overrides,
});

describe("Adventure same-day end-time form", () => {
  it("keeps End time visible without an end date and saves the same-day range", async () => {
    const onSubmit = vi.fn().mockResolvedValue(undefined);
    render(
      <AdventureFormSheet
        title="Edit Adventure"
        initialPlan={plan()}
        onClose={vi.fn()}
        onSubmit={onSubmit}
      />,
    );

    expect(screen.getByLabelText("Adventure end time")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Adventure end time"), {
      target: { value: "15:00" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Create Adventure" }));

    await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(
      expect.objectContaining({
        date: "2026-07-26",
        endDate: "",
        startTime: "11:30",
        endTime: "15:00",
      }),
    ));
  });

  it("preserves end time as end date is added and removed", () => {
    render(
      <AdventureFormSheet
        title="Edit Adventure"
        initialPlan={plan({ endTime: "15:00" })}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    const endDate = screen.getByLabelText("Adventure end date") as HTMLInputElement;
    const endTime = screen.getByLabelText("Adventure end time") as HTMLInputElement;

    fireEvent.change(endDate, { target: { value: "2026-07-28" } });
    expect(endTime.value).toBe("15:00");
    fireEvent.change(endDate, { target: { value: "" } });
    expect(endTime.value).toBe("15:00");
  });

  it("clears the end time when the start time is cleared", () => {
    render(
      <AdventureFormSheet
        title="Edit Adventure"
        initialPlan={plan({ endTime: "15:00" })}
        onClose={vi.fn()}
        onSubmit={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    fireEvent.change(screen.getByLabelText("Adventure start time"), {
      target: { value: "" },
    });
    expect((screen.getByLabelText("Adventure end time") as HTMLInputElement).value)
      .toBe("");
  });
});

describe("itinerary stop day form", () => {
  it("hides Day for a single-day Adventure and assigns its start date", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <StopEditorSheet
        adventureId="adventure-id"
        adventureDate="2026-07-26"
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    expect(screen.queryByLabelText("Day")).toBeNull();
    fireEvent.change(screen.getByLabelText("Stop title"), {
      target: { value: "Breakfast" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Add stop" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Breakfast", dayDate: "2026-07-26" }),
    ));
  });

  it("shows every day, defaults new stops to Day 1, and restores an existing day", () => {
    const { unmount } = render(
      <StopEditorSheet
        adventureId="adventure-id"
        adventureDate="2026-07-26"
        adventureEndDate="2026-07-28"
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    const newDay = screen.getByLabelText("Day") as HTMLSelectElement;
    expect(newDay.value).toBe("2026-07-26");
    expect(Array.from(newDay.options).map(({ text }) => text)).toEqual([
      "Day 1 — Sun, Jul 26",
      "Day 2 — Mon, Jul 27",
      "Day 3 — Tue, Jul 28",
    ]);

    unmount();
    render(
      <StopEditorSheet
        adventureId="adventure-id"
        adventureDate="2026-07-26"
        adventureEndDate="2026-07-28"
        stop={stop()}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );
    expect((screen.getByLabelText("Day") as HTMLSelectElement).value)
      .toBe("2026-07-27");
    expect((screen.getByLabelText("Stop title") as HTMLInputElement).value)
      .toBe("Lunch");
    expect((screen.getByLabelText("Stop notes") as HTMLTextAreaElement).value)
      .toBe("Window table");
  });
});
