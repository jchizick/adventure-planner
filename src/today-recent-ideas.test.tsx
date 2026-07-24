// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import pagesSource from "./pages.tsx?raw";
import type { Adventure, Idea } from "./types";

const mocks = vi.hoisted(() => ({
  useAdventureStore: vi.fn(),
  useIdeas: vi.fn(),
  useWorkspace: vi.fn(),
}));

vi.mock("./context", () => ({ useAdventureStore: mocks.useAdventureStore }));
vi.mock("./ideas", () => ({ useIdeas: mocks.useIdeas }));
vi.mock("./workspace", () => ({ useWorkspace: mocks.useWorkspace }));

import { Today } from "./pages";

const nextAdventure: Adventure = {
  id: "next-adventure",
  title: "Dinner downtown",
  description: "",
  date: "2026-07-20",
  startTime: "7:00 PM",
  endTime: "",
  status: "Confirmed",
  location: "Toronto",
  savedLocation: { kind: "text", label: "Toronto" },
  stops: [],
  notes: "",
  links: [],
  checklist: [],
  addedBy: "Member",
  updatedBy: "Member",
  completed: false,
  favorite: false,
  tags: [],
};

function idea(overrides: Partial<Idea> = {}): Idea {
  return {
    id: "live-idea",
    title: "Live gallery visit",
    description: "",
    category: "culture",
    status: "Tentative",
    tags: [],
    addedBy: "Jordan",
    isDateNight: false,
    createdAt: "2026-07-15T12:00:00Z",
    ...overrides,
  };
}

function renderToday() {
  return render(
    <MemoryRouter initialEntries={["/today"]}>
      <Routes>
        <Route path="/today" element={<Today />} />
        <Route path="/ideas" element={<div>Ideas destination</div>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-07-19T12:00:00-04:00"));
  mocks.useWorkspace.mockReset().mockReturnValue({
    activeSpace: { id: "space-id", name: "Shared plans" },
  });
  mocks.useAdventureStore.mockReset().mockReturnValue({
    adventures: [nextAdventure],
    loading: false,
    error: null,
    retry: vi.fn(),
    createAdventure: vi.fn(),
  });
  mocks.useIdeas.mockReset().mockReturnValue({
    ideas: [idea()],
    loading: false,
    error: null,
  });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("Today recent Ideas", () => {
  it("retains the shared-space eyebrow for the desktop Today header", () => {
    renderToday();

    expect(screen.getByText("Shared plans").classList).toContain(
      "today-space-eyebrow",
    );
  });

  it("renders the compact cover and title without status or author metadata", () => {
    renderToday();

    const title = screen.getByText("Live gallery visit");
    const card = title.closest("button");
    expect(card).toBeTruthy();
    expect(card?.classList.contains("idea-rail-card")).toBe(true);
    expect(card?.textContent).not.toContain("Added by Jordan");
    expect(card?.textContent).not.toContain("Tentative");
    expect(card?.querySelector("img")?.getAttribute("src")).toBe(
      "/category-art/covers/culture/03.webp",
    );
    expect(card?.firstElementChild?.classList.contains("idea-cover-thumbnail"))
      .toBe(true);
  });

  it("shows one tag and the correct overflow while preserving a balanced no-tag zone", () => {
    mocks.useIdeas.mockReturnValue({
      ideas: [idea({ tags: ["date-night", "seasonal", "rainy-day"] })],
      loading: false,
      error: null,
    });
    const { container } = renderToday();

    expect(screen.getByText("Date Night")).toBeTruthy();
    expect(screen.getByLabelText("2 more tags").textContent).toBe("+2");
    expect(screen.queryByText("Seasonal")).toBeNull();
    expect(container.querySelectorAll(".idea-rail-tags .tag-chip")).toHaveLength(2);

    cleanup();
    mocks.useIdeas.mockReturnValue({
      ideas: [idea({ tags: [] })],
      loading: false,
      error: null,
    });
    const noTagRender = renderToday();
    expect(noTagRender.container.querySelector(".idea-rail-tag-zone")).toBeTruthy();
  });

  it("shows a restrained three-card loading treatment without hiding Today", () => {
    mocks.useIdeas.mockReturnValue({ ideas: [], loading: true, error: null });
    const { container } = renderToday();

    expect(screen.getByRole("status", { name: "Loading new ideas" })).toBeTruthy();
    expect(container.querySelectorAll(".idea-rail-skeleton")).toHaveLength(3);
    expect(screen.getAllByText("Dinner downtown")).toHaveLength(2);
  });

  it("renders the entire empty state as an accessible Ideas link", () => {
    mocks.useIdeas.mockReturnValue({ ideas: [], loading: false, error: null });
    renderToday();

    const emptyState = screen.getByRole("link", {
      name: "No ideas yet — add one for your next adventure.",
    });
    expect(emptyState.classList.contains("today-ideas-empty")).toBe(true);
    expect(emptyState.getAttribute("href")).toBe("/ideas");
    expect(emptyState.querySelector("a, button")).toBeNull();

    fireEvent.click(emptyState);
    expect(screen.getByText("Ideas destination")).toBeTruthy();
  });

  it("keeps the rest of Today available when the Ideas provider fails", () => {
    mocks.useIdeas.mockReturnValue({
      ideas: [],
      loading: false,
      error: "Ideas could not be loaded",
    });
    renderToday();

    expect(screen.getAllByText("Dinner downtown")).toHaveLength(2);
    expect(screen.getByText("New ideas are temporarily unavailable.")).toBeTruthy();
  });

  it("keeps See All linked to Ideas and card activation follows that route", () => {
    renderToday();
    expect(
      screen.getByRole("link", { name: "See all ideas" }).getAttribute("href"),
    ).toBe("/ideas");

    fireEvent.click(screen.getByText("Live gallery visit").closest("button")!);
    expect(screen.getByText("Ideas destination")).toBeTruthy();
  });

  it("keeps the latest-three count and clamps long titles inside the card copy", () => {
    mocks.useIdeas.mockReturnValue({
      ideas: [
        idea({ id: "fourth", title: "Fourth", createdAt: "2026-07-12T12:00:00Z" }),
        idea({ id: "second", title: "Second", createdAt: "2026-07-14T12:00:00Z" }),
        idea({ id: "first", title: "A very long newly created Idea title that should stay inside its compact card", createdAt: "2026-07-15T12:00:00Z" }),
        idea({ id: "third", title: "Third", createdAt: "2026-07-13T12:00:00Z" }),
      ],
      loading: false,
      error: null,
    });
    const { container } = renderToday();

    expect(container.querySelectorAll(".idea-rail-card")).toHaveLength(3);
    expect(screen.queryByText("Fourth")).toBeNull();
    expect(screen.getByText(/A very long newly created/).classList)
      .toContain("idea-rail-title");
  });

  it("contains no Today-page references to the retired mock Ideas", () => {
    for (const retiredTitle of [
      "Olive Garden Vaughan",
      "McMichael Gallery",
      "Ford concert",
    ]) {
      expect(pagesSource).not.toContain(retiredTitle);
    }
    expect(pagesSource).not.toContain("prototypeIdeas");
    expect(pagesSource).not.toContain('from "./data"');
  });
});
