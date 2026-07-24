// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import memoryDetailSource from "./memory-detail.tsx?raw";
import type { Adventure, MemorySummary } from "./types";

const styles = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

const mocks = vi.hoisted(() => ({
  useAdventureStore: vi.fn(),
  loadMemorySummaries: vi.fn(),
  subscribeToAdventureRatings: vi.fn(() => ({ topic: "memory-cards" })),
  unsubscribeFromAdventureRatings: vi.fn(),
}));

vi.mock("./context", () => ({ useAdventureStore: mocks.useAdventureStore }));
vi.mock("./repositories/memories", async () => {
  const actual = await vi.importActual<typeof import("./repositories/memories")>(
    "./repositories/memories",
  );
  return { ...actual, loadMemorySummaries: mocks.loadMemorySummaries };
});
vi.mock("./repositories/ratings", async () => {
  const actual = await vi.importActual<typeof import("./repositories/ratings")>(
    "./repositories/ratings",
  );
  return {
    ...actual,
    subscribeToAdventureRatings: mocks.subscribeToAdventureRatings,
    unsubscribeFromAdventureRatings: mocks.unsubscribeFromAdventureRatings,
  };
});

import { Memories } from "./pages";

const longReflection =
  "This is a deliberately long shared reflection that should remain fully available in the document while the visual preview is constrained to three calm lines across every completed Memory card in the grid.";
const longLocation =
  "A very long waterfront destination name with a boardwalk, gardens, and an observation point";

function adventure(id: string, title: string, location: string): Adventure {
  return {
    id,
    title,
    description: `${title} description`,
    date: "2026-07-20",
    startTime: "",
    endTime: "",
    status: "Completed",
    location,
    savedLocation: { kind: "text", label: location },
    tags: [],
    stops: [],
    notes: "",
    links: [],
    checklist: [],
    addedBy: "Jordan",
    updatedBy: "Jordan",
    completed: true,
    completedAt: `2026-07-2${id}T12:00:00Z`,
    favorite: false,
  };
}

const adventures = [
  adventure("3", "Unrated walk", longLocation),
  adventure("2", "Two-member dinner", "Neighbourhood restaurant"),
  adventure("1", "Rated island day", "Toronto Islands"),
];

const emptyRating = {
  average: null,
  count: 0,
  wouldDoAgainYes: 0,
  wouldDoAgainNo: 0,
  wouldDoAgainUnanswered: 0,
};

const summaries: Record<string, MemorySummary> = {
  "1": {
    adventureId: "1",
    reflection: longReflection,
    photoCount: 1,
    rating: {
      average: 3,
      count: 1,
      wouldDoAgainYes: 1,
      wouldDoAgainNo: 0,
      wouldDoAgainUnanswered: 0,
    },
  },
  "2": {
    adventureId: "2",
    reflection: "Dinner was lovely.",
    photoCount: 2,
    rating: {
      average: 4.5,
      count: 2,
      wouldDoAgainYes: 2,
      wouldDoAgainNo: 0,
      wouldDoAgainUnanswered: 0,
    },
  },
  "3": {
    adventureId: "3",
    reflection: "",
    photoCount: 0,
    rating: emptyRating,
  },
};

function renderMemories() {
  return render(
    <MemoryRouter initialEntries={["/memories"]}>
      <Routes>
        <Route path="/memories" element={<Memories />} />
        <Route path="/memories/:adventureId" element={<h1>Memory detail destination</h1>} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  mocks.useAdventureStore.mockReset().mockReturnValue({
    adventures,
    loading: false,
    error: null,
    retry: vi.fn(),
  });
  mocks.loadMemorySummaries.mockReset().mockResolvedValue(summaries);
  mocks.subscribeToAdventureRatings.mockClear();
  mocks.unsubscribeFromAdventureRatings.mockClear();
});

afterEach(cleanup);

describe("completed Memory card previews", () => {
  it("uses a three-line preview structure while keeping the full text available once", async () => {
    const { container } = renderMemories();
    await screen.findByText(longReflection);
    const preview = screen.getByText(longReflection);
    expect(preview.classList.contains("memory-card-preview")).toBe(true);
    expect(preview.textContent).toBe(longReflection);
    expect(container.querySelectorAll(".memory-card-preview")).toHaveLength(3);
    expect(styles).toMatch(/\.memory-card-preview[\s\S]*max-height:\s*4\.65em/);
    expect(styles).toMatch(/-webkit-line-clamp:\s*3/);
    expect(styles).toMatch(/\.memory-card-preview[\s\S]*overflow:\s*hidden/);
  });

  it("keeps the full shared reflection rendering on Memory detail", () => {
    expect(memoryDetailSource).toContain("<blockquote>{memory.reflection}</blockquote>");
  });

  it("separates location, photo count, and optional rating into stable rows", async () => {
    const { container } = renderMemories();
    await screen.findByText(longReflection);
    const ratedCard = screen.getByText("Rated island day").closest(".memory-card")!;
    const location = ratedCard.querySelector(".memory-card-location")!;
    const photoCount = ratedCard.querySelector(".memory-card-photo-count")!;
    const ratingRow = ratedCard.querySelector(".memory-card-rating-row")!;
    expect(location.textContent).toBe("Toronto Islands");
    expect(location.textContent).not.toContain("rating");
    expect(photoCount.textContent).toBe("1 photo");
    expect(ratingRow.textContent).toContain("3 \u00b7 1 rating");
    expect(location.parentElement).toBe(ratingRow.parentElement);
    expect(location).not.toBe(ratingRow);

    const twoRatingCard = screen.getByText("Two-member dinner").closest(".memory-card")!;
    expect(twoRatingCard.querySelector(".memory-card-rating")?.textContent)
      .toContain("4.5 \u00b7 2 ratings");
    expect(twoRatingCard.querySelector(".memory-card-photo-count")?.textContent)
      .toBe("2 photos");

    const unratedCard = screen.getByText("Unrated walk").closest(".memory-card")!;
    expect(unratedCard.querySelector(".memory-card-rating")).toBeNull();
    expect(unratedCard.querySelector(".memory-card-rating-row")).toBeTruthy();
    expect(unratedCard.querySelector(".memory-card-photo-count")?.textContent)
      .toBe("Add photos");
    expect(container.querySelectorAll(".memory-card-rating")).toHaveLength(2);
  });

  it("keeps long locations separate from ratings and preserves card navigation", async () => {
    renderMemories();
    await screen.findByText(longLocation);
    const card = screen.getByText("Unrated walk").closest<HTMLButtonElement>(".memory-card")!;
    expect(card.querySelector(".memory-card-location")?.textContent).toBe(longLocation);
    expect(card.querySelector(".memory-card-location .memory-card-rating")).toBeNull();
    fireEvent.click(card);
    await waitFor(() =>
      expect(screen.getByRole("heading", { name: "Memory detail destination" })).toBeTruthy(),
    );
  });
});
