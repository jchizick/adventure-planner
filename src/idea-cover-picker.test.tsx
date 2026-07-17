// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { IdeaCoverPicker } from "./idea-cover-picker";
import type { Idea } from "./types";

beforeAll(() => {
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
  URL.createObjectURL = vi.fn(() => "blob:idea-cover-preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

const idea: Idea = {
  id: "idea-id",
  title: "Dinner downtown",
  description: "Try somewhere new",
  category: "food-drink",
  status: "Idea",
  tags: [],
  addedBy: "Member",
  isDateNight: false,
  createdAt: "2026-07-15T12:00:00Z",
};

function renderPicker(
  current: Idea = idea,
  onSave = vi.fn().mockResolvedValue(undefined),
  onClose = vi.fn(),
) {
  render(<IdeaCoverPicker idea={current} onSave={onSave} onClose={onClose} />);
  return { onSave, onClose };
}

describe("IdeaCoverPicker", () => {
  it("shows Automatic and the expanded presets for the current category", () => {
    renderPicker();
    const choices = within(screen.getByLabelText("Idea cover choices"));

    expect(screen.getByRole("button", { name: /Automatic/ }).getAttribute("aria-pressed"))
      .toBe("true");
    expect(choices.getAllByRole("button")).toHaveLength(9);
    expect(choices.getByRole("button", { name: "Use Romantic dinner cover" })).toBeTruthy();
    expect(choices.getByRole("button", { name: "Use Sushi bar cover" })).toBeTruthy();
    expect(screen.getByLabelText(/External image URL/i)).toBeTruthy();
    expect(screen.getByLabelText(/Upload photo/i)).toBeTruthy();
  });

  it("persists a selected preset and restores the selection on reload", async () => {
    const { onSave } = renderPicker();
    fireEvent.click(screen.getByRole("button", { name: "Use Quiet cafe cover" }));
    fireEvent.click(screen.getByRole("button", { name: "Save cover" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ coverPresetId: "food-cafe" }));
    cleanup();
    renderPicker({ ...idea, coverPresetId: "food-cafe" });
    expect(screen.getByRole("button", { name: "Use Quiet cafe cover" }).getAttribute("aria-pressed"))
      .toBe("true");
  });

  it("persists Automatic as an absent preset and Cancel does not save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    const onClose = vi.fn();
    renderPicker({ ...idea, coverPresetId: "food-cafe" }, onSave, onClose);

    fireEvent.click(screen.getByRole("button", { name: /Automatic/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save cover" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({}));

    cleanup();
    const nextSave = vi.fn().mockResolvedValue(undefined);
    renderPicker(idea, nextSave, onClose);
    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(nextSave).not.toHaveBeenCalled();
  });

  it("preserves an explicit cross-category cover while offering the new category", () => {
    renderPicker({ ...idea, category: "outdoors", coverPresetId: "food-cafe" });
    const choices = within(screen.getByLabelText("Idea cover choices"));

    expect(choices.getAllByRole("button")).toHaveLength(10);
    expect(choices.getByRole("button", { name: "Use Quiet cafe cover" }).getAttribute("aria-pressed"))
      .toBe("true");
    expect(choices.getByRole("button", { name: "Use Forest trail cover" })).toBeTruthy();
  });

  it("falls back safely and allows an unknown preset to be repaired to Automatic", async () => {
    const { onSave } = renderPicker({ ...idea, coverPresetId: "retired-preset" });

    expect(screen.getByRole("button", { name: /Automatic/ }).getAttribute("aria-pressed"))
      .toBe("true");
    expect((screen.getByRole("button", { name: "Save cover" }) as HTMLButtonElement).disabled)
      .toBe(false);
    fireEvent.click(screen.getByRole("button", { name: "Save cover" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({}));
  });

  it("previews an uploaded photo and submits the original file for processing", async () => {
    const { onSave } = renderPicker();
    const file = new File([new Uint8Array([1, 2, 3])], "cover.png", { type: "image/png" });
    fireEvent.change(screen.getByLabelText("Upload photo"), { target: { files: [file] } });
    await waitFor(() => expect((screen.getByAltText("Idea cover preview") as HTMLImageElement).src)
      .toContain("blob:idea-cover-preview"));
    fireEvent.click(screen.getByRole("button", { name: "Save cover" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ uploadFile: file }));
  });
});
