// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CoverPhotoSheet } from "./pages";

beforeAll(() => {
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
  URL.createObjectURL = vi.fn(() => "blob:adventure-cover-preview");
  URL.revokeObjectURL = vi.fn();
});

afterEach(cleanup);

describe("Adventure CoverPhotoSheet", () => {
  it("renders the unified source selector and only the active source controls", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CoverPhotoSheet
        adventure={{ id: "adventure-id", category: "outdoors" }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getAllByRole("radio")).toHaveLength(3);
    expect(screen.getByRole("radio", { name: "Automatic" }).getAttribute("aria-checked"))
      .toBe("true");
    expect(screen.getAllByRole("button", { name: /^Use .* cover$/ })).toHaveLength(9);
    expect(screen.queryByLabelText("Custom image URL")).toBeNull();

    fireEvent.click(screen.getByRole("button", { name: "Use Canoe on the lake cover" }));
    fireEvent.click(screen.getByRole("button", { name: "Save cover" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ coverVariant: 2 }));
  });

  it("persists an expanded category choice through the existing image path field", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CoverPhotoSheet
        adventure={{ id: "adventure-id", category: "outdoors" }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: "Use Waterfall boardwalk cover" }));
    fireEvent.click(screen.getByRole("button", { name: "Save cover" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({
      coverImage: "/category-art/covers/outdoors/07.webp",
    }));
  });

  it("restores a persisted expanded category choice", () => {
    render(
      <CoverPhotoSheet
        adventure={{
          id: "adventure-id",
          category: "outdoors",
          coverImage: "/category-art/covers/outdoors/07.webp",
        }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect(screen.getByRole("button", { name: "Use Waterfall boardwalk cover" })
      .getAttribute("aria-pressed")).toBe("true");
    expect((screen.getByRole("button", { name: "Save cover" }) as HTMLButtonElement).disabled)
      .toBe(true);
  });

  it("retains an existing custom image URL independently from presets", () => {
    render(
      <CoverPhotoSheet
        adventure={{
          id: "adventure-id",
          category: "outdoors",
          coverImage: "https://images.example/adventure.webp",
        }}
        onClose={vi.fn()}
        onSave={vi.fn().mockResolvedValue(undefined)}
      />,
    );

    expect((screen.getByLabelText("Custom image URL") as HTMLInputElement).value)
      .toBe("https://images.example/adventure.webp");
    expect((screen.getByAltText("Adventure cover preview") as HTMLImageElement).src)
      .toContain("https://images.example/adventure.webp");
    expect(screen.getByRole("radio", { name: "Image URL" }).getAttribute("aria-checked"))
      .toBe("true");
    expect(screen.queryByLabelText("Category cover choices")).toBeNull();
  });

  it("retains clearing an explicit preset back to Automatic", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CoverPhotoSheet
        adventure={{ id: "adventure-id", category: "outdoors", coverVariant: 2 }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    fireEvent.click(screen.getByRole("button", { name: /Use automatic cover/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save cover" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({}));
  });

  it("supports an uploaded cover without removing existing cover choices", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CoverPhotoSheet
        adventure={{ id: "adventure-id", category: "outdoors" }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    const file = new File([new Uint8Array([1, 2, 3])], "cover.webp", { type: "image/webp" });
    fireEvent.click(screen.getByRole("radio", { name: "Upload photo" }));
    fireEvent.change(screen.getByLabelText("Upload photo"), { target: { files: [file] } });
    await waitFor(() => expect((screen.getByAltText("Adventure cover preview") as HTMLImageElement).src)
      .toContain("blob:adventure-cover-preview"));
    fireEvent.click(screen.getByRole("button", { name: "Save cover" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ uploadFile: file }));
    expect(screen.queryByLabelText("Category cover choices")).toBeNull();
  });

  it("does not discard an upload when the source is switched before Save", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CoverPhotoSheet
        adventure={{ id: "adventure-id", category: "outdoors" }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );
    const file = new File([new Uint8Array([7, 8, 9])], "kept.webp", {
      type: "image/webp",
    });
    fireEvent.click(screen.getByRole("radio", { name: "Upload photo" }));
    fireEvent.change(screen.getByLabelText("Upload photo"), {
      target: { files: [file] },
    });
    fireEvent.click(screen.getByRole("radio", { name: "Automatic" }));
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("radio", { name: "Upload photo" }));
    fireEvent.click(screen.getByRole("button", { name: "Save cover" }));

    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ uploadFile: file }));
  });
});
