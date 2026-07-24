// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { AdventureCalendarExport } from "./adventure-calendar-export";
import type { Adventure } from "./types";

function adventure(overrides: Partial<Adventure> = {}): Adventure {
  return {
    id: "adventure-123",
    title: "Concert night",
    description: "Dinner before the show.",
    date: "2026-07-21",
    startTime: "7:00 PM",
    endTime: "10:00 PM",
    status: "Confirmed",
    location: "Massey Hall",
    savedLocation: { kind: "text", label: "Massey Hall" },
    timezone: "America/Toronto",
    stops: [],
    notes: "",
    links: [],
    checklist: [],
    addedBy: "Planner",
    updatedBy: "Planner",
    completed: false,
    favorite: false,
    ...overrides,
    tags: overrides.tags ?? [],
  };
}

beforeEach(() => {
  URL.createObjectURL = vi.fn(() => "blob:calendar-export");
  URL.revokeObjectURL = vi.fn();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("Adventure calendar export actions", () => {
  it("shows one-way export actions only for valid dated Adventures", () => {
    const { rerender } = render(<AdventureCalendarExport adventure={adventure()} />);
    expect(screen.getByRole("heading", { name: "Add to calendar" })).toBeTruthy();
    expect(screen.getByText(/Future changes in Our Adventures will not update it automatically/)).toBeTruthy();
    const google = screen.getByRole("link", { name: /Add to Google Calendar/ });
    expect(google.getAttribute("target")).toBe("_blank");
    expect(google.getAttribute("rel")).toBe("noopener noreferrer");
    expect(new URL(google.getAttribute("href") ?? "").hostname).toBe("calendar.google.com");
    expect(screen.getByRole("button", { name: "Download .ics file" })).toBeTruthy();

    rerender(<AdventureCalendarExport adventure={adventure({ date: "" })} />);
    expect(screen.queryByRole("heading", { name: "Add to calendar" })).toBeNull();
  });

  it("downloads an .ics file without mutating the Adventure", () => {
    const source = adventure();
    const snapshot = structuredClone(source);
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);
    render(<AdventureCalendarExport adventure={source} />);

    fireEvent.click(screen.getByRole("button", { name: "Download .ics file" }));

    expect(URL.createObjectURL).toHaveBeenCalledOnce();
    expect(click).toHaveBeenCalledOnce();
    expect(source).toEqual(snapshot);
  });

  it("announces a recoverable download error", () => {
    vi.mocked(URL.createObjectURL).mockImplementation(() => {
      throw new Error("Unavailable");
    });
    render(<AdventureCalendarExport adventure={adventure()} />);

    fireEvent.click(screen.getByRole("button", { name: "Download .ics file" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "We could not create the calendar file",
    );
  });
});
