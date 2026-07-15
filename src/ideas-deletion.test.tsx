// @vitest-environment jsdom

import { useState } from "react";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { emptyAdvancedIdeaFilters, filterIdeas } from "./idea-model";
import type { Idea } from "./types";

const mocks = vi.hoisted(() => ({
  deleteIdea: vi.fn(),
  loadIdeas: vi.fn(),
  activeSpace: { id: "space-id", name: "Shared" },
}));

vi.mock("./auth", () => ({
  useAuth: () => ({ user: { id: "user-id" } }),
}));

vi.mock("./workspace", () => ({
  useWorkspace: () => ({ activeSpace: mocks.activeSpace }),
}));

vi.mock("./repositories/ideas", async () => {
  const actual = await vi.importActual<typeof import("./repositories/ideas")>(
    "./repositories/ideas",
  );
  return {
    ...actual,
    loadIdeas: mocks.loadIdeas,
    deleteIdea: mocks.deleteIdea,
  };
});

import { IdeasProvider, useIdeas } from "./ideas";

const ideas: Idea[] = [
  {
    id: "delete-me",
    spaceId: "space-id",
    title: "Keep search matching",
    description: "Delete this one",
    category: "culture",
    status: "Idea",
    tags: [],
    addedBy: "Member",
    isDateNight: false,
    createdAt: "2026-07-15",
  },
  {
    id: "keep-me",
    spaceId: "space-id",
    title: "Keep search result",
    description: "Keep this one",
    category: "food-drink",
    status: "Idea",
    tags: [],
    addedBy: "Member",
    isDateNight: false,
    createdAt: "2026-07-15",
  },
];

function StateHarness() {
  const { ideas: current, deleteIdea } = useIdeas();
  const [query, setQuery] = useState("Keep search");
  const [category] = useState<"all">("all");
  const [failure, setFailure] = useState("");
  const shown = filterIdeas(current, category, query, emptyAdvancedIdeaFilters);
  const cultureCount = current.filter((idea) => idea.category === "culture").length;
  return (
    <>
      <label>
        Search
        <input value={query} onChange={(event) => setQuery(event.target.value)} />
      </label>
      <output aria-label="Idea count">{current.length}</output>
      <output aria-label="Culture count">{cultureCount}</output>
      <output aria-label="Filtered titles">{shown.map((idea) => idea.title).join("|")}</output>
      {failure && <p role="alert">{failure}</p>}
      <button
        onClick={() => {
          void deleteIdea("delete-me").catch((error: unknown) => {
            setFailure(error instanceof Error ? error.message : "Delete failed");
          });
        }}
      >
        Delete test idea
      </button>
    </>
  );
}

beforeAll(() => {
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
});

beforeEach(() => {
  mocks.loadIdeas.mockReset().mockResolvedValue(ideas);
  mocks.deleteIdea.mockReset().mockResolvedValue(undefined);
});

afterEach(cleanup);

describe("IdeasProvider deletion state", () => {
  it("removes the Idea, updates counts, and preserves the current search/filter", async () => {
    render(<IdeasProvider><StateHarness /></IdeasProvider>);
    await waitFor(() => expect(screen.getByLabelText("Idea count").textContent).toBe("2"));

    fireEvent.click(screen.getByRole("button", { name: "Delete test idea" }));

    await waitFor(() => expect(screen.getByLabelText("Culture count").textContent).toBe("0"));
    expect(mocks.deleteIdea).toHaveBeenCalledTimes(1);
    expect(mocks.deleteIdea).toHaveBeenCalledWith("space-id", "delete-me");
    expect(screen.getByLabelText("Idea count").textContent).toBe("1");
    expect(screen.getByLabelText("Culture count").textContent).toBe("0");
    expect(screen.getByRole("textbox", { name: "Search" })).toHaveProperty(
      "value",
      "Keep search",
    );
    expect(screen.getByLabelText("Filtered titles").textContent).toBe(
      "Keep search result",
    );
  });

  it("preserves the Idea when deletion fails", async () => {
    mocks.deleteIdea.mockRejectedValueOnce(new Error("Delete unavailable. Try again."));
    render(<IdeasProvider><StateHarness /></IdeasProvider>);
    await waitFor(() => expect(screen.getByLabelText("Idea count").textContent).toBe("2"));

    fireEvent.click(screen.getByRole("button", { name: "Delete test idea" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "Delete unavailable. Try again.",
    );
    expect(screen.getByLabelText("Idea count").textContent).toBe("2");
  });
});
