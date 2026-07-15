// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { IdeaSheet } from "./pages";
import type { Idea } from "./types";

const idea: Idea = {
  id: "idea-id",
  spaceId: "space-id",
  title: "Picnic by the lake",
  description: "Bring a blanket",
  category: "outdoors",
  status: "Idea",
  tags: [],
  addedBy: "Member",
  isDateNight: false,
  createdAt: "2026-07-15",
};

function renderSheet({
  canDelete = true,
  onDelete = vi.fn().mockResolvedValue(undefined),
  onClose = vi.fn(),
}: {
  canDelete?: boolean;
  onDelete?: (id: string) => Promise<void>;
  onClose?: () => void;
} = {}) {
  render(
    <IdeaSheet
      idea={idea}
      canDelete={canDelete}
      onClose={onClose}
      onSave={vi.fn().mockResolvedValue(undefined)}
      onStatus={vi.fn().mockResolvedValue(undefined)}
      onDelete={onDelete}
      onPlan={vi.fn()}
      onView={vi.fn()}
    />,
  );
  return { onDelete, onClose };
}

beforeAll(() => {
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
});

afterEach(cleanup);

describe("IdeaSheet deletion", () => {
  it("shows the separated destructive action only for editable Ideas", () => {
    const { rerender } = render(
      <IdeaSheet
        idea={idea}
        canDelete
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onStatus={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onPlan={vi.fn()}
        onView={vi.fn()}
      />,
    );
    const trigger = screen.getByRole("button", { name: "Delete idea" });
    expect(trigger.closest(".idea-delete-section")).toBeTruthy();

    rerender(
      <IdeaSheet
        idea={idea}
        canDelete={false}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onStatus={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onPlan={vi.fn()}
        onView={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: "Delete idea" })).toBeNull();
  });

  it("requires confirmation and Cancel preserves the Idea", async () => {
    const { onDelete, onClose } = renderSheet();
    fireEvent.click(screen.getByRole("button", { name: "Delete idea" }));

    const dialog = screen.getByRole("alertdialog", {
      name: "Delete “Picnic by the lake”?",
    });
    expect(within(dialog).getByText(
      "This idea will be permanently deleted. This cannot be undone.",
    )).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();

    fireEvent.click(within(dialog).getByRole("button", { name: "Cancel" }));
    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Edit idea" })).toBeTruthy();
    expect(onDelete).not.toHaveBeenCalled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it("calls deletion once and disables duplicate confirmation while pending", async () => {
    let resolveDelete!: () => void;
    const onDelete = vi.fn(() => new Promise<void>((resolve) => {
      resolveDelete = resolve;
    }));
    const { onClose } = renderSheet({ onDelete });
    fireEvent.click(screen.getByRole("button", { name: "Delete idea" }));
    const dialog = screen.getByRole("alertdialog");
    const confirm = within(dialog).getByRole("button", { name: "Delete idea" });

    fireEvent.click(confirm);
    expect(onDelete).toHaveBeenCalledTimes(1);
    const pendingButton = within(dialog).getByRole<HTMLButtonElement>("button", {
      name: "Deleting…",
    });
    expect(pendingButton.disabled).toBe(true);
    fireEvent.click(pendingButton);
    expect(onDelete).toHaveBeenCalledTimes(1);

    await act(async () => resolveDelete());
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps the edit sheet available, reports failure, and allows retry", async () => {
    const onDelete = vi
      .fn<(id: string) => Promise<void>>()
      .mockRejectedValueOnce(new Error("We could not delete this idea. Please try again."))
      .mockResolvedValueOnce(undefined);
    const { onClose } = renderSheet({ onDelete });
    fireEvent.click(screen.getByRole("button", { name: "Delete idea" }));
    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete idea" }));

    expect((await screen.findByRole("alert")).textContent).toBe(
      "We could not delete this idea. Please try again.",
    );
    expect(screen.getByRole("dialog", { name: "Edit idea" })).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(within(screen.getByRole("alertdialog")).getByRole("button", { name: "Delete idea" }));
    await waitFor(() => expect(onClose).toHaveBeenCalledTimes(1));
    expect(onDelete).toHaveBeenCalledTimes(2);
  });

  it("Escape closes only confirmation and restores focus to Delete idea", async () => {
    const { onClose, onDelete } = renderSheet();
    const trigger = screen.getByRole("button", { name: "Delete idea" });
    trigger.focus();
    fireEvent.click(trigger);
    await waitFor(() => expect(document.activeElement).toBe(
      within(screen.getByRole("alertdialog")).getByRole("button", { name: "Cancel" }),
    ));

    fireEvent.keyDown(document, { key: "Escape" });

    expect(screen.queryByRole("alertdialog")).toBeNull();
    expect(screen.getByRole("dialog", { name: "Edit idea" })).toBeTruthy();
    expect(document.activeElement).toBe(trigger);
    expect(onClose).not.toHaveBeenCalled();
    expect(onDelete).not.toHaveBeenCalled();
  });
});
