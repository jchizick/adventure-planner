// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState, type FormEvent } from "react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CoverPickerSheet } from "./cover-picker";

beforeAll(() => {
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
});

afterEach(cleanup);

function Picker({
  onClose = vi.fn(),
  onSubmit = vi.fn((event: FormEvent) => event.preventDefault()),
  onSelectSource = vi.fn(),
}: {
  onClose?: () => void;
  onSubmit?: (event: FormEvent) => void;
  onSelectSource?: (source: "automatic" | "upload" | "url") => void;
}) {
  return (
    <CoverPickerSheet
      title="Change cover"
      previewSource="/category-art/food-drink-1.webp"
      previewAlt="Cover preview"
      fallbackSource="/category-art/general.webp"
      sectionTitle="Covers"
      sectionDescription="Choose a cover."
      automaticDescription="Uses a stable cover."
      automaticSelected={false}
      source="automatic"
      options={[
        {
          value: "first",
          label: "First cover",
          source: "/category-art/food-drink-1.webp",
          ariaLabel: "Use first cover",
        },
      ]}
      selectedValue="first"
      saving={false}
      canSave
      onSelectSource={onSelectSource}
      onSelectAutomatic={vi.fn()}
      onSelectOption={vi.fn()}
      onClose={onClose}
      onSubmit={onSubmit}
    />
  );
}

describe("CoverPickerSheet", () => {
  it("renders the preview, Automatic choice, supplied options, and selected state", () => {
    render(<Picker />);

    expect(screen.getByRole("img", { name: "Cover preview" }).getAttribute("src"))
      .toBe("/category-art/food-drink-1.webp");
    expect(screen.getByRole("radio", { name: "Automatic" }).getAttribute("aria-checked"))
      .toBe("true");
    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("button", { name: /Use automatic cover/ }).getAttribute("aria-pressed"))
      .toBe("false");
    expect(screen.getByRole("button", { name: "Use first cover" }).getAttribute("aria-pressed"))
      .toBe("true");
    expect((screen.getByRole("button", { name: "Save cover" }) as HTMLButtonElement).disabled)
      .toBe(false);
  });

  it("isolates Escape to the nested picker and restores focus", async () => {
    function Harness() {
      const [open, setOpen] = useState(false);
      return (
        <>
          <button onClick={() => setOpen(true)}>Change cover</button>
          {open && <Picker onClose={() => setOpen(false)} />}
        </>
      );
    }

    render(<Harness />);
    const trigger = screen.getByRole("button", { name: "Change cover" });
    trigger.focus();
    fireEvent.click(trigger);
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    await waitFor(() => expect(document.activeElement).toBe(trigger));
  });

  it("routes Save through submit and Cancel only through close", () => {
    const onSubmit = vi.fn((event: FormEvent) => event.preventDefault());
    const onClose = vi.fn();
    render(<Picker onSubmit={onSubmit} onClose={onClose} />);

    fireEvent.click(screen.getByRole("button", { name: "Save cover" }));
    expect(onSubmit).toHaveBeenCalledTimes(1);
    expect(onClose).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Cancel" }));
    expect(onClose).toHaveBeenCalledTimes(1);
    expect(onSubmit).toHaveBeenCalledTimes(1);
  });

  it("supports radio-group arrow-key source selection", () => {
    const onSelectSource = vi.fn();
    render(<Picker onSelectSource={onSelectSource} />);
    const automatic = screen.getByRole("radio", { name: "Automatic" });
    automatic.focus();

    fireEvent.keyDown(automatic, { key: "ArrowRight" });

    expect(onSelectSource).toHaveBeenCalledWith("upload");
    expect(document.activeElement).toBe(
      screen.getByRole("radio", { name: "Upload photo" }),
    );
  });
});
