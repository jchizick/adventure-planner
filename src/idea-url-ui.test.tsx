// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { IdeaSheet } from "./pages";
import type { Idea } from "./types";

const idea: Idea = {
  id: "idea-1",
  title: "Museum afternoon",
  description: "See the new exhibit",
  category: "culture",
  status: "Idea",
  tags: [],
  addedBy: "Planner",
  isDateNight: false,
  createdAt: "2026-07-15T12:00:00Z",
  optionalLink: "https://example.com/exhibit?q=summer",
};

function renderSheet(onSave = vi.fn().mockResolvedValue(undefined), current = idea) {
  render(
    <IdeaSheet
      idea={current}
      mode="edit"
      canDelete
      onClose={vi.fn()}
      onSave={onSave}
      onDelete={vi.fn()}
      onPlan={vi.fn()}
      onView={vi.fn()}
    />,
  );
  return onSave;
}

afterEach(cleanup);

describe("Idea website field", () => {
  it("renders a safe external link with new-tab protections", () => {
    renderSheet();
    const link = screen.getByRole("link", { name: /open link for museum afternoon/i });
    expect(link.getAttribute("href")).toBe(idea.optionalLink);
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("normalizes a domain on save and allows an empty value", async () => {
    const save = renderSheet();
    fireEvent.change(screen.getByLabelText("Website or link"), { target: { value: "  example.com/path?q=one  " } });
    fireEvent.click(screen.getByRole("button", { name: "Save idea" }));
    await waitFor(() => expect(save).toHaveBeenCalledWith(expect.objectContaining({
      optionalLink: "https://example.com/path?q=one",
    })));

    cleanup();
    const emptySave = renderSheet();
    fireEvent.change(screen.getByLabelText("Website or link"), { target: { value: "" } });
    fireEvent.click(screen.getByRole("button", { name: "Save idea" }));
    await waitFor(() => expect(emptySave).toHaveBeenCalledWith(expect.objectContaining({
      optionalLink: undefined,
    })));
  });

  it("announces malformed and unsafe URLs without saving", async () => {
    const save = renderSheet();
    fireEvent.change(screen.getByLabelText("Website or link"), { target: { value: "javascript:alert(1)" } });
    fireEvent.click(screen.getByRole("button", { name: "Save idea" }));
    expect((await screen.findByRole("alert")).textContent).toContain("http:// or https://");
    expect(save).not.toHaveBeenCalled();
    expect(screen.queryByRole("link", { name: /open link/i })).toBeNull();
  });
});
