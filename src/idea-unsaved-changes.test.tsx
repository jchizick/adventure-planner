// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Link, RouterProvider, createMemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { IdeaSheet } from "./pages";
import { NavigationGuardProvider } from "./navigation-guard";
import { ideaDraftKey, saveIdeaDraft, type IdeaDraftScope } from "./idea-drafts";
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
  updatedAt: "2026-07-15T12:00:00Z",
};
const scope: IdeaDraftScope = {
  userId: "user-1",
  spaceId: "space-1",
  mode: "edit",
  ideaId: idea.id,
};

function sheet(overrides: Partial<Parameters<typeof IdeaSheet>[0]> = {}) {
  return (
    <IdeaSheet
      idea={idea}
      draftScope={scope}
      canDelete
      onClose={vi.fn()}
      onSave={vi.fn().mockResolvedValue(undefined)}
      onDelete={vi.fn().mockResolvedValue(undefined)}
      onPlan={vi.fn()}
      onView={vi.fn()}
      {...overrides}
    />
  );
}

function navigationHarness() {
  const router = createMemoryRouter([
    {
      path: "/ideas",
      element: (
        <NavigationGuardProvider>
          {sheet()}
          <Link to="/today">Today</Link>
        </NavigationGuardProvider>
      ),
    },
    { path: "/today", element: <h1>Today route</h1> },
  ], { initialEntries: ["/ideas"] });
  render(<RouterProvider router={router} />);
  return router;
}

beforeEach(() => localStorage.clear());
afterEach(cleanup);

describe("Idea unsaved-change protection", () => {
  it("allows clean internal navigation without a prompt", async () => {
    navigationHarness();
    fireEvent.click(screen.getByRole("link", { name: "Today" }));
    expect(await screen.findByRole("heading", { name: "Today route" })).toBeTruthy();
    expect(screen.queryByRole("alertdialog", { name: "Discard unsaved changes?" })).toBeNull();
  });

  it("keeps editing or completes navigation after explicit discard", async () => {
    const router = navigationHarness();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Changed title" } });
    fireEvent.click(screen.getByRole("link", { name: "Today" }));
    expect(screen.getByRole("alertdialog", { name: "Discard unsaved changes?" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Keep editing" }));
    expect(router.state.location.pathname).toBe("/ideas");
    expect(screen.getByDisplayValue("Changed title")).toBeTruthy();

    fireEvent.click(screen.getByRole("link", { name: "Today" }));
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(await screen.findByRole("heading", { name: "Today route" })).toBeTruthy();
  });

  it("registers browser unload protection only while dirty", () => {
    navigationHarness();
    const cleanEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(cleanEvent);
    expect(cleanEvent.defaultPrevented).toBe(false);
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Changed title" } });
    const dirtyEvent = new Event("beforeunload", { cancelable: true });
    window.dispatchEvent(dirtyEvent);
    expect(dirtyEvent.defaultPrevented).toBe(true);
  });

  it("keeps failed saves dirty and clears drafts after successful save", async () => {
    const failure = vi.fn().mockRejectedValue(new Error("Save failed"));
    render(sheet({ onSave: failure }));
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Changed title" } });
    fireEvent.click(screen.getByRole("button", { name: "Save idea" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Save failed");
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("alertdialog", { name: "Discard unsaved changes?" })).toBeTruthy();

    cleanup();
    saveIdeaDraft(localStorage, scope, { ...idea, title: "Recovered" });
    const close = vi.fn();
    render(sheet({ onClose: close }));
    expect(await screen.findByText("Unsaved draft restored.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Save idea" }));
    await waitFor(() => expect(close).toHaveBeenCalledOnce());
    expect(localStorage.getItem(ideaDraftKey(scope))).toBeNull();
  });

  it("restores scoped drafts without visibility changes or refreshes overwriting edits", async () => {
    saveIdeaDraft(localStorage, scope, { ...idea, title: "Recovered" });
    const { rerender } = render(sheet());
    expect(await screen.findByDisplayValue("Recovered")).toBeTruthy();
    fireEvent.change(screen.getByLabelText("Title"), { target: { value: "Active edit" } });
    document.dispatchEvent(new Event("visibilitychange"));
    expect(screen.getByDisplayValue("Active edit")).toBeTruthy();
    rerender(sheet({ idea: { ...idea, description: "Background refresh" } }));
    expect(screen.getByDisplayValue("Active edit")).toBeTruthy();
    expect((screen.getByLabelText("Description") as HTMLTextAreaElement).value).toBe("See the new exhibit");
  });
});
