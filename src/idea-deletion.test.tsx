// @vitest-environment jsdom

import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
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

describe("IdeaSheet cover editing", () => {
  it("renders the compact Cover field and removes redundant standalone actions", () => {
    renderSheet();

    const coverControl = screen.getByRole("button", { name: "Change idea cover" });
    expect(coverControl.closest(".idea-cover-field")).toBeTruthy();
    expect(within(coverControl).getByText("Automatic cover")).toBeTruthy();
    const thumbnail = coverControl.querySelector("img");
    if (!thumbnail) throw new Error("Expected the compact cover thumbnail.");
    expect(thumbnail.getAttribute("width")).toBe("52");
    expect(thumbnail.getAttribute("height")).toBe("52");
    expect(screen.queryByRole("button", { name: "Change cover" })).toBeNull();
    expect(screen.queryByRole("button", { name: "Change status" })).toBeNull();
    expect(screen.getByLabelText("Status")).toBeTruthy();
  });

  it("opens the shared picker and persists only the selected cover", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <IdeaSheet
        idea={idea}
        canDelete
        onClose={vi.fn()}
        onSave={onSave}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onPlan={vi.fn()}
        onView={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Title"), {
      target: { value: "Unsaved title edit" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Change idea cover" }));

    expect(screen.getByRole("dialog", { name: "Change cover" })).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Use Canoe on the lake cover" }));
    fireEvent.click(screen.getByRole("button", { name: "Save cover" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({
        ...idea,
        coverPresetId: "outdoors-canoe-lake",
      }),
    );
    expect(screen.queryByRole("dialog", { name: "Change cover" })).toBeNull();
    expect((screen.getByLabelText("Title") as HTMLInputElement).value).toBe(
      "Unsaved title edit",
    );
  });

  it("keeps the Status select in the normal Save idea flow", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    render(
      <IdeaSheet
        idea={idea}
        canDelete
        onClose={onClose}
        onSave={onSave}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onPlan={vi.fn()}
        onView={vi.fn()}
      />,
    );

    fireEvent.change(screen.getByLabelText("Status"), {
      target: { value: "Tentative" },
    });
    fireEvent.click(screen.getByRole("button", { name: "Save idea" }));

    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ ...idea, status: "Tentative" }),
    );
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("keeps an explicit cover selected after an unsaved category change", () => {
    render(
      <IdeaSheet
        idea={{ ...idea, category: "food-drink", coverPresetId: "food-cafe" }}
        canDelete
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onPlan={vi.fn()}
        onView={vi.fn()}
      />,
    );
    fireEvent.change(screen.getByLabelText("Category"), {
      target: { value: "outdoors" },
    });
    expect(screen.getByText("Quiet cafe")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: "Change idea cover" }));

    expect(
      screen.getByRole("button", { name: "Use Quiet cafe cover" })
        .getAttribute("aria-pressed"),
    ).toBe("true");
    expect(screen.getByRole("button", { name: "Use Forest trail cover" })).toBeTruthy();
  });

  it("keeps promotion quiet and preserves its existing callback", () => {
    const onPlan = vi.fn();
    render(
      <IdeaSheet
        idea={idea}
        canDelete
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onPlan={onPlan}
        onView={vi.fn()}
      />,
    );

    const promotion = screen.getByRole("button", { name: /Turn into an adventure/ });
    expect(promotion.classList.contains("idea-promotion-action")).toBe(true);
    fireEvent.click(promotion);
    expect(onPlan).toHaveBeenCalledWith(idea);
  });

  it("Escape closes only the nested picker and restores focus to the Cover field", async () => {
    const onClose = vi.fn();
    renderSheet({ onClose });
    const trigger = screen.getByRole("button", { name: "Change idea cover" });
    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Title")));
    trigger.focus();
    fireEvent.click(trigger);
    expect(screen.getByRole("dialog", { name: "Change cover" })).toBeTruthy();

    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() =>
      expect(screen.queryByRole("dialog", { name: "Change cover" })).toBeNull(),
    );
    expect(screen.getByRole("dialog", { name: "Edit idea" })).toBeTruthy();
    await waitFor(() => expect(document.activeElement).toBe(trigger));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("IdeaSheet Date Night control", () => {
  it("renders one coherent native-checkbox row and loads an existing value", () => {
    render(
      <IdeaSheet
        idea={{ ...idea, isDateNight: true }}
        canDelete
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onPlan={vi.fn()}
        onView={vi.fn()}
      />,
    );

    const checkbox = screen.getByRole<HTMLInputElement>("checkbox", {
      name: /Date Night/,
    });
    const row = checkbox.closest("label");
    expect(row?.classList.contains("date-night-field")).toBe(true);
    expect(row?.classList.contains("selected")).toBe(true);
    expect(screen.getByText("Mark this as a date idea")).toBeTruthy();
    expect(checkbox.checked).toBe(true);
  });

  it("toggles from the whole row and with the keyboard", async () => {
    const user = userEvent.setup();
    renderSheet();
    const checkbox = screen.getByRole<HTMLInputElement>("checkbox", {
      name: /Date Night/,
    });
    const row = checkbox.closest("label");
    if (!row) throw new Error("Expected the Date Night label row.");

    await waitFor(() => expect(document.activeElement).toBe(screen.getByLabelText("Title")));
    fireEvent.click(row);
    expect(checkbox.checked).toBe(true);
    checkbox.focus();
    await user.keyboard("[Space]");
    expect(checkbox.checked).toBe(false);
  });

  it("saves the selected value while closing without Save does not persist", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    const { unmount } = render(
      <IdeaSheet
        idea={idea}
        canDelete
        onClose={onClose}
        onSave={onSave}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onPlan={vi.fn()}
        onView={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Date Night").closest("label")!);
    fireEvent.click(screen.getByRole("button", { name: "Save idea" }));
    await waitFor(() =>
      expect(onSave).toHaveBeenCalledWith({ ...idea, isDateNight: true }),
    );

    unmount();
    const cancelSave = vi.fn().mockResolvedValue(undefined);
    const cancelClose = vi.fn();
    render(
      <IdeaSheet
        idea={idea}
        canDelete
        onClose={cancelClose}
        onSave={cancelSave}
        onDelete={vi.fn().mockResolvedValue(undefined)}
        onPlan={vi.fn()}
        onView={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByText("Date Night").closest("label")!);
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.getByRole("alertdialog", { name: "Discard unsaved changes?" })).toBeTruthy();
    expect(cancelClose).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Discard changes" }));
    expect(cancelClose).toHaveBeenCalledTimes(1);
    expect(cancelSave).not.toHaveBeenCalled();
  });
});
