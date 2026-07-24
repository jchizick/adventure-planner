// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AdventureRatingWithMember } from "./types";

const repository = vi.hoisted(() => ({
  listAdventureRatings: vi.fn(),
  saveCurrentUserRating: vi.fn(),
  deleteCurrentUserRating: vi.fn(),
  subscribeToAdventureRatings: vi.fn(() => ({ topic: "ratings" })),
  unsubscribeFromAdventureRatings: vi.fn(),
}));

vi.mock("./repositories/ratings", () => repository);

import { MemoryRatings } from "./memory-ratings";

const currentRating: AdventureRatingWithMember = {
  id: "rating-1",
  adventureId: "adventure-1",
  userId: "user-1",
  rating: 5,
  wouldDoAgain: true,
  note: "Perfect day.",
  createdAt: "2026-07-24T00:00:00Z",
  updatedAt: "2026-07-24T00:00:00Z",
  memberName: "Jordan",
  memberAvatarUrl: null,
};

beforeAll(() => {
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
});

beforeEach(() => {
  repository.listAdventureRatings.mockReset().mockResolvedValue([]);
  repository.saveCurrentUserRating.mockReset();
  repository.deleteCurrentUserRating.mockReset().mockResolvedValue(undefined);
  repository.subscribeToAdventureRatings.mockClear();
  repository.unsubscribeFromAdventureRatings.mockClear();
});

afterEach(cleanup);

describe("MemoryRatings", () => {
  it("shows an unrated state and requires a star score", async () => {
    render(<MemoryRatings adventureId="adventure-1" currentUserId="user-1" />);
    expect(await screen.findByText("No ratings yet")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
    expect(await screen.findByText("Choose a star rating before saving.")).toBeTruthy();
    expect(repository.saveCurrentUserRating).not.toHaveBeenCalled();
  });

  it("saves one trimmed personal rating and updates the summary without reload", async () => {
    repository.saveCurrentUserRating.mockResolvedValue([currentRating]);
    render(<MemoryRatings adventureId="adventure-1" currentUserId="user-1" />);
    await screen.findByText("No ratings yet");
    fireEvent.click(screen.getByRole("radio", { name: "5 stars" }));
    fireEvent.click(screen.getByRole("radio", { name: "Yes" }));
    fireEvent.change(screen.getByLabelText("Personal note"), {
      target: { value: "  Perfect day.  " },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
    await waitFor(() => expect(repository.saveCurrentUserRating).toHaveBeenCalledTimes(1));
    expect(repository.saveCurrentUserRating).toHaveBeenCalledWith({
      adventureId: "adventure-1",
      rating: 5,
      wouldDoAgain: true,
      note: "Perfect day.",
    });
    expect(await screen.findByText("1 rating")).toBeTruthy();
    expect(screen.getByText("Jordan · You")).toBeTruthy();
  });

  it("loads an existing rating, clears the optional answer, and preserves edits on failure", async () => {
    repository.listAdventureRatings.mockResolvedValue([currentRating]);
    repository.saveCurrentUserRating.mockRejectedValue(new Error("Save failed safely."));
    render(<MemoryRatings adventureId="adventure-1" currentUserId="user-1" />);
    expect(await screen.findByText("Jordan · You")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Edit" }));
    expect((screen.getByRole("radio", { name: "5 stars" }) as HTMLInputElement).checked).toBe(true);
    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    fireEvent.change(screen.getByLabelText("Personal note"), {
      target: { value: "Keep this draft" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save rating" }));
    expect(await screen.findByText("Save failed safely.")).toBeTruthy();
    expect((screen.getByLabelText("Personal note") as HTMLTextAreaElement).value)
      .toBe("Keep this draft");
    expect(repository.saveCurrentUserRating).toHaveBeenCalledWith(
      expect.objectContaining({ wouldDoAgain: null }),
    );
  });

  it("removes only the current member rating after confirmation", async () => {
    repository.listAdventureRatings.mockResolvedValue([currentRating]);
    render(<MemoryRatings adventureId="adventure-1" currentUserId="user-1" />);
    await screen.findByText("Jordan · You");
    fireEvent.click(screen.getByRole("button", { name: "Remove" }));
    expect(screen.getByText("Remove your rating?")).toBeTruthy();
    fireEvent.click(screen.getAllByRole("button", { name: "Remove" })[1]);
    await waitFor(() =>
      expect(repository.deleteCurrentUserRating).toHaveBeenCalledWith("rating-1"),
    );
    expect(await screen.findByText("No ratings yet")).toBeTruthy();
  });
});
