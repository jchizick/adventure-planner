// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Idea } from "./types";

const mocks = vi.hoisted(() => ({
  useIdeas: vi.fn(),
  useAdventureStore: vi.fn(),
  useWorkspace: vi.fn(),
  loadSpaceMembers: vi.fn(),
  deleteIdea: vi.fn(),
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
  mocks.deleteIdea.mockReset().mockResolvedValue(undefined);
  mocks.useIdeas.mockReset().mockReturnValue({
    ideas: [idea],
    loading: false,
    error: null,
    retry: vi.fn(),
    saveIdea: vi.fn(),
    setIdeaStatus: vi.fn(),
    deleteIdea: mocks.deleteIdea,
  });
  mocks.useAdventureStore.mockReset().mockReturnValue({
    promoteIdeaToAdventure: vi.fn(),
  });
  mocks.useWorkspace.mockReset().mockReturnValue({
    activeSpace: { id: "space-id", name: "Shared plans" },
    memberships: [{ spaceId: "space-id" }],
    profile: { id: "current-user", displayName: "Liz" },
  });
  mocks.loadSpaceMembers
    .mockReset()
    .mockResolvedValue([{ userId: "user-id", displayName: "Jordan" }]);
});

afterEach(cleanup);

describe("Saved Idea cover rendering", () => {
  it("uses the shared photo thumbnail while leaving all ten filter glyphs intact", () => {
    const { container } = render(
      <MemoryRouter>
        <Ideas />
      </MemoryRouter>,
    );

    const filters = container.querySelectorAll(".category-tile");
    expect(filters).toHaveLength(9);
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
    render(
      <MemoryRouter>
        <Ideas />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Edit Hiking through the park" }));
    expect(screen.getByRole("dialog", { name: "Edit idea" })).toBeTruthy();
  });

  it("opens a separate prefilled duplicate from the Idea menu", () => {
    render(
      <MemoryRouter>
        <Ideas />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", { name: "More actions for Hiking through the park" }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Duplicate idea" }));
    expect(screen.getByRole("dialog", { name: "Duplicate idea" })).toBeTruthy();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe("Hiking through the park — Copy");
    expect((screen.getByLabelText("Status") as HTMLSelectElement).value).toBe("Idea");
    expect(idea.id).toBe("trail-idea");
  });

  it("renders the compact hierarchy with canonical author, tags, and separate status", async () => {
    mocks.useIdeas.mockReturnValue({
      ideas: [{
        ...idea,
        tags: ["date-night", "seasonal", "rainy-day"],
      }],
      loading: false,
      error: null,
      retry: vi.fn(),
      saveIdea: vi.fn(),
      deleteIdea: mocks.deleteIdea,
    });
    mocks.loadSpaceMembers.mockResolvedValue([
      { userId: "user-id", displayName: "A much longer current profile name" },
    ]);
    const { container } = render(
      <MemoryRouter>
        <Ideas />
      </MemoryRouter>,
    );

    const card = container.querySelector<HTMLElement>(".idea-card")!;
    expect(within(card).getByText("Date Night")).toBeTruthy();
    expect(within(card).getByText("Seasonal")).toBeTruthy();
    expect(within(card).getByLabelText("1 more tags").textContent).toBe("+1");
    expect(card.querySelector(".idea-card-metadata .status")?.textContent)
      .toBe("Tentative");
    await waitFor(() =>
      expect(card.querySelector(".idea-card-author")?.textContent)
        .toContain("A much longer current profile name"),
    );
    expect(card.querySelector(".idea-body > p")).toBeNull();
  });

  it("opens the existing delete confirmation and Cancel does not delete", () => {
    render(
      <MemoryRouter>
        <Ideas />
      </MemoryRouter>,
    );

    fireEvent.click(screen.getByRole("button", {
      name: "More actions for Hiking through the park",
    }));
    const menu = screen.getByRole("menu");
    expect(within(menu).getAllByRole("menuitem").map((item) => item.textContent?.trim()))
      .toEqual(["Edit idea", "Duplicate idea", "Delete idea"]);
    const deleteItem = within(menu).getByRole("menuitem", { name: "Delete idea" });
    expect(deleteItem.classList).toContain("destructive");
    fireEvent.click(deleteItem);

    const dialog = screen.getByRole("alertdialog");
    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(mocks.deleteIdea).not.toHaveBeenCalled();
  });

  it("confirms deletion through the existing provider flow", async () => {
    render(
      <MemoryRouter>
        <Ideas />
      </MemoryRouter>,
    );
    fireEvent.click(screen.getByRole("button", {
      name: "More actions for Hiking through the park",
    }));
    fireEvent.click(screen.getByRole("menuitem", { name: "Delete idea" }));
    fireEvent.click(within(screen.getByRole("alertdialog"))
      .getByRole("button", { name: "Delete idea" }));

    await waitFor(() => expect(mocks.deleteIdea).toHaveBeenCalledWith("trail-idea"));
    expect(mocks.deleteIdea).toHaveBeenCalledTimes(1);
  });
});
