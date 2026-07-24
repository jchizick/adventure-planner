// @vitest-environment jsdom

import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
  within,
} from "@testing-library/react";
import {
  MemoryRouter,
  Route,
  Routes,
  useLocation,
  useNavigate,
} from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type {
  Adventure,
  AdventureRatingSummary,
  MemorySummary,
} from "./types";

const mocks = vi.hoisted(() => ({
  useAdventureStore: vi.fn(),
  loadMemorySummaries: vi.fn(),
  ratingChange: null as null | (() => void),
  subscribeToAdventureRatings: vi.fn(
    (_subscriptionKey: string, onChange: () => void) => {
      mocks.ratingChange = onChange;
      return { topic: "memory-filters" };
    },
  ),
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

function adventure({
  id,
  title,
  completedAt,
  category,
  tags,
}: {
  id: string;
  title: string;
  completedAt: string;
  category: Adventure["category"];
  tags: string[];
}): Adventure {
  return {
    id,
    title,
    description: `${title} reflection fallback`,
    date: completedAt.slice(0, 10),
    startTime: "",
    endTime: "",
    status: "Completed",
    location: `${title} location`,
    savedLocation: { kind: "text", label: `${title} location` },
    category,
    tags,
    stops: [],
    notes: "",
    links: [],
    checklist: [],
    addedBy: "Member",
    updatedBy: "Member",
    completed: true,
    completedAt,
    favorite: false,
  };
}

function rating({
  average,
  count,
  yes = 0,
  no = 0,
}: {
  average: number | null;
  count: number;
  yes?: number;
  no?: number;
}): AdventureRatingSummary {
  return {
    average,
    count,
    wouldDoAgainYes: yes,
    wouldDoAgainNo: no,
    wouldDoAgainUnanswered: count - yes - no,
  };
}

function summary(
  adventureId: string,
  aggregate: AdventureRatingSummary,
): MemorySummary {
  return {
    adventureId,
    reflection: `${adventureId} shared reflection`,
    photoCount: 1,
    rating: aggregate,
  };
}

const adventures = [
  adventure({
    id: "unrated",
    title: "Quiet library walk",
    completedAt: "2026-07-06T12:00:00Z",
    category: "errands",
    tags: [],
  }),
  adventure({
    id: "blocked",
    title: "One-time rooftop",
    completedAt: "2026-07-05T12:00:00Z",
    category: "social",
    tags: ["friends-family"],
  }),
  adventure({
    id: "favourite-one",
    title: "Forest overlook",
    completedAt: "2026-07-04T12:00:00Z",
    category: "outdoors",
    tags: ["seasonal"],
  }),
  adventure({
    id: "favourite-two",
    title: "Dinner by the lake",
    completedAt: "2026-07-03T12:00:00Z",
    category: "outdoors",
    tags: ["date-night"],
  }),
  adventure({
    id: "favourite-three",
    title: "Gallery afternoon",
    completedAt: "2026-07-02T12:00:00Z",
    category: "culture",
    tags: ["date-night"],
  }),
  adventure({
    id: "favourite-four",
    title: "Seasonal brunch",
    completedAt: "2026-07-01T12:00:00Z",
    category: "food-drink",
    tags: ["seasonal"],
  }),
];

const summaries: Record<string, MemorySummary> = {
  blocked: summary("blocked", rating({
    average: 5,
    count: 2,
    yes: 1,
    no: 1,
  })),
  "favourite-one": summary("favourite-one", rating({
    average: 5,
    count: 1,
    yes: 1,
  })),
  "favourite-two": summary("favourite-two", rating({
    average: 4.5,
    count: 2,
    yes: 2,
  })),
  "favourite-three": summary("favourite-three", rating({
    average: 4.5,
    count: 1,
    yes: 1,
  })),
  "favourite-four": summary("favourite-four", rating({
    average: 4,
    count: 1,
    yes: 1,
  })),
  unrated: summary("unrated", rating({ average: null, count: 0 })),
};

function LocationProbe() {
  const location = useLocation();
  const navigate = useNavigate();
  return (
    <>
      <output aria-label="Current Memory query">{location.search}</output>
      <button type="button" onClick={() => navigate(-1)}>
        Test browser back
      </button>
    </>
  );
}

function renderMemories(initialEntry = "/memories") {
  return render(
    <MemoryRouter initialEntries={[initialEntry]}>
      <Routes>
        <Route
          path="/memories"
          element={(
            <>
              <Memories />
              <LocationProbe />
            </>
          )}
        />
        <Route
          path="/memories/:adventureId"
          element={<h1>Memory detail destination</h1>}
        />
      </Routes>
    </MemoryRouter>,
  );
}

function mainGrid(container: HTMLElement) {
  return container.querySelector<HTMLElement>(".memory-grid")!;
}

function mainTitles(container: HTMLElement) {
  return [...mainGrid(container).querySelectorAll(".memory-card h3")]
    .map((heading) => heading.textContent);
}

beforeEach(() => {
  mocks.useAdventureStore.mockReset().mockReturnValue({
    adventures,
    loading: false,
    error: null,
    retry: vi.fn(),
  });
  mocks.loadMemorySummaries.mockReset().mockResolvedValue(summaries);
  mocks.ratingChange = null;
  mocks.subscribeToAdventureRatings.mockClear();
  mocks.unsubscribeFromAdventureRatings.mockClear();
});

afterEach(cleanup);

describe("Memories favourites and controls", () => {
  it("shows three favourites initially, keeps them in the main list, and opens detail", async () => {
    const { container } = renderMemories();
    const favouritesHeading = await screen.findByRole("heading", {
      name: "Our favourites",
    });
    const favouritesSection = favouritesHeading.closest<HTMLElement>("section")!;
    expect(favouritesSection.querySelectorAll(".favourite-memory-card"))
      .toHaveLength(3);
    expect(within(favouritesSection).getAllByText(/ratings?$/).length)
      .toBeGreaterThan(0);
    expect(mainGrid(container).querySelectorAll(".memory-card")).toHaveLength(6);
    expect(within(mainGrid(container)).getByText("Forest overlook")).toBeTruthy();
    expect(within(favouritesSection).queryByText(/^#\d+$/)).toBeNull();

    fireEvent.click(within(favouritesSection).getByRole("button", {
      name: "See all favourites",
    }));
    expect(favouritesSection.querySelectorAll(".favourite-memory-card"))
      .toHaveLength(4);

    fireEvent.click(within(favouritesSection).getByRole("button", {
      name: /Forest overlook/,
    }));
    expect(await screen.findByRole("heading", {
      name: "Memory detail destination",
    })).toBeTruthy();
  });

  it("defaults to Most recent and writes transparent sorting to the URL", async () => {
    const { container } = renderMemories();
    await screen.findByRole("heading", { name: "Our favourites" });
    const sort = screen.getByLabelText<HTMLSelectElement>(
      "Sort completed memories",
    );
    expect(sort.value).toBe("most-recent");
    expect(mainTitles(container)[0]).toBe("Quiet library walk");

    fireEvent.change(sort, { target: { value: "highest-rated" } });
    await waitFor(() => expect(
      screen.getByLabelText("Current Memory query").textContent,
    ).toContain("sort=highest-rated"));
    expect(mainTitles(container).slice(0, 3)).toEqual([
      "One-time rooftop",
      "Forest overlook",
      "Dinner by the lake",
    ]);
    expect(screen.getByText(
      "Average rating first, then number of ratings.",
    )).toBeTruthy();

    fireEvent.click(screen.getByRole("button", {
      name: "Test browser back",
    }));
    await waitFor(() => expect(sort.value).toBe("most-recent"));
    expect(screen.getByLabelText("Current Memory query").textContent).toBe("");
    expect(mainTitles(container)[0]).toBe("Quiet library walk");
  });

  it("resolves rating conflicts, combines compact filters, and clears them", async () => {
    const { container } = renderMemories();
    await screen.findByRole("heading", { name: "Our favourites" });
    fireEvent.click(screen.getByRole("button", { name: /^Memory filters/ }));
    const dialog = screen.getByRole("dialog", { name: "Memory filters" });

    fireEvent.click(within(dialog).getByLabelText("Unrated"));
    await waitFor(() =>
      expect(mainTitles(container)).toEqual(["Quiet library walk"]),
    );
    expect(screen.getByLabelText("Current Memory query").textContent)
      .toContain("rating=unrated");

    fireEvent.click(within(dialog).getByLabelText("Would do again"));
    await waitFor(() => expect(mainTitles(container)).toHaveLength(4));
    expect(mainTitles(container)).not.toContain("Quiet library walk");
    expect(screen.getByLabelText("Current Memory query").textContent)
      .toContain("rating=would-do-again");
    expect(screen.getByLabelText("Current Memory query").textContent)
      .not.toContain("unrated");

    fireEvent.click(within(dialog).getByLabelText("Outdoors"));
    fireEvent.click(within(dialog).getByLabelText("Date Night"));
    await waitFor(() =>
      expect(mainTitles(container)).toEqual(["Dinner by the lake"]),
    );
    const activeFilters = container.querySelector<HTMLElement>(
      ".memory-active-filters",
    )!;
    expect(within(activeFilters).getByText("Would do again")).toBeTruthy();
    expect(within(activeFilters).getByText("Outdoors")).toBeTruthy();
    expect(within(activeFilters).getByText("Date Night")).toBeTruthy();

    fireEvent.click(within(activeFilters).getByRole("button", {
      name: "Clear filters",
    }));
    await waitFor(() => expect(mainTitles(container)).toHaveLength(6));
    expect(screen.getByLabelText("Current Memory query").textContent).toBe("");

    fireEvent.click(within(dialog).getByLabelText("Unrated"));
    fireEvent.click(within(dialog).getByLabelText("Date Night"));
    const filteredEmptyHeading = await screen.findByRole("heading", {
      name: "No memories match these filters",
    });
    const filteredEmpty = filteredEmptyHeading.closest<HTMLElement>(
      ".memory-filter-empty",
    )!;
    fireEvent.click(within(filteredEmpty).getByRole("button", {
      name: "Clear filters",
    }));
    await waitFor(() => expect(mainTitles(container)).toHaveLength(6));
  });

  it("renders the restrained favourites empty state without a See all action", async () => {
    mocks.loadMemorySummaries.mockResolvedValueOnce(
      Object.fromEntries(adventures.map((item) => [
        item.id,
        summary(item.id, rating({ average: null, count: 0 })),
      ])),
    );
    renderMemories();
    expect(await screen.findByText("Our favourites will appear here"))
      .toBeTruthy();
    expect(screen.getByText(
      "Rate completed adventures and mark the ones you would do again.",
    )).toBeTruthy();
    expect(screen.queryByRole("button", { name: "See all favourites" }))
      .toBeNull();
  });

  it("reconciles favourites and filtered ordering after realtime rating changes", async () => {
    const target = adventures.find((item) => item.id === "favourite-one")!;
    mocks.useAdventureStore.mockReturnValue({
      adventures: [target],
      loading: false,
      error: null,
      retry: vi.fn(),
    });
    const initial = {
      [target.id]: summary(target.id, rating({
        average: 3,
        count: 1,
        yes: 1,
      })),
    };
    const qualifying = {
      [target.id]: summary(target.id, rating({
        average: 5,
        count: 1,
        yes: 1,
      })),
    };
    const declined = {
      [target.id]: summary(target.id, rating({
        average: 5,
        count: 1,
        no: 1,
      })),
    };
    const deleted = {
      [target.id]: summary(target.id, rating({
        average: null,
        count: 0,
      })),
    };
    mocks.loadMemorySummaries
      .mockReset()
      .mockResolvedValueOnce(initial)
      .mockResolvedValueOnce(qualifying)
      .mockResolvedValueOnce(declined)
      .mockResolvedValueOnce(deleted);

    const { container } = renderMemories(
      "/memories?sort=highest-rated&rating=rated",
    );
    await screen.findByText("Our favourites will appear here");
    expect(mainGrid(container).querySelectorAll(".memory-card")).toHaveLength(1);

    mocks.ratingChange?.();
    await waitFor(() =>
      expect(container.querySelector(".favourite-memory-card")).toBeTruthy(),
    );

    mocks.ratingChange?.();
    await waitFor(() =>
      expect(container.querySelector(".favourite-memory-card")).toBeNull(),
    );

    mocks.ratingChange?.();
    await waitFor(() =>
      expect(mainGrid(container).querySelectorAll(".memory-card")).toHaveLength(0),
    );
    expect(screen.getByRole("heading", {
      name: "No memories match these filters",
    })).toBeTruthy();
    expect(screen.getByLabelText<HTMLSelectElement>(
      "Sort completed memories",
    ).value).toBe("highest-rated");
    expect(screen.getByLabelText("Current Memory query").textContent)
      .toContain("rating=rated");
    expect(container.querySelectorAll(".memory-card")).toHaveLength(0);
  });
});
