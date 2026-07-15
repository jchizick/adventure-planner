// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Idea } from "./types";

const mocks = vi.hoisted(() => ({
  useIdeas: vi.fn(),
  useAdventureStore: vi.fn(),
  useWorkspace: vi.fn(),
  loadSpaceMembers: vi.fn(),
}));

vi.mock("./ideas", () => ({ useIdeas: mocks.useIdeas }));
vi.mock("./context", () => ({ useAdventureStore: mocks.useAdventureStore }));
vi.mock("./workspace", () => ({ useWorkspace: mocks.useWorkspace }));
vi.mock("./repositories/invitations", () => ({
  loadSpaceMembers: mocks.loadSpaceMembers,
}));

import { Ideas } from "./pages";

const idea: Idea = {
  id: "trail-idea",
  spaceId: "space-id",
  title: "Hiking through the park",
  description: "Bring the day pack",
  category: "outdoors",
  status: "Tentative",
  tags: [],
  addedBy: "Jordan",
  addedByUserId: "user-id",
  isDateNight: false,
  createdAt: "2026-07-15T12:00:00Z",
};

beforeEach(() => {
  mocks.useIdeas.mockReset().mockReturnValue({
    ideas: [idea],
    loading: false,
    error: null,
    retry: vi.fn(),
    saveIdea: vi.fn(),
    setIdeaStatus: vi.fn(),
    deleteIdea: vi.fn(),
  });
  mocks.useAdventureStore.mockReset().mockReturnValue({
    promoteIdeaToAdventure: vi.fn(),
  });
  mocks.useWorkspace.mockReset().mockReturnValue({
    activeSpace: { id: "space-id", name: "Shared plans" },
    memberships: [{ spaceId: "space-id" }],
  });
  mocks.loadSpaceMembers
    .mockReset()
    .mockResolvedValue([{ userId: "user-id", displayName: "Jordan" }]);
});

afterEach(cleanup);

describe("Saved Idea cover rendering", () => {
  it("uses the shared photo thumbnail while leaving all eight filter glyphs intact", () => {
    const { container } = render(
      <MemoryRouter>
        <Ideas />
      </MemoryRouter>,
    );

    const filters = container.querySelectorAll(".category-tile");
    expect(filters).toHaveLength(8);
    for (const filter of filters) {
      expect(filter.querySelector("svg")).toBeTruthy();
      expect(filter.querySelector("img")).toBeNull();
    }

    const card = container.querySelector<HTMLElement>(".idea-card")!;
    const image = card.querySelector<HTMLImageElement>("img")!;
    expect(card.querySelector(".idea-cover-thumbnail")).toBeTruthy();
    expect(image.getAttribute("src")).toBe(
      "/category-art/covers/outdoors/01.webp",
    );
    expect(image.getAttribute("alt")).toBe("");
    expect(card.textContent).toContain("Tentative");
    expect(card.textContent).toContain("Added by Jordan");
    expect(card.querySelector("svg")).toBeTruthy();
  });

  it("preserves the existing card interaction", () => {
    const { container } = render(
      <MemoryRouter>
        <Ideas />
      </MemoryRouter>,
    );
    fireEvent.click(container.querySelector(".idea-card")!);
    expect(screen.getByRole("dialog", { name: "Edit idea" })).toBeTruthy();
  });
});
