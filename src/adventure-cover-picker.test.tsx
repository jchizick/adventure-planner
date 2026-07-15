// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { CoverPhotoSheet } from "./pages";

beforeAll(() => {
  window.requestAnimationFrame = (callback) => window.setTimeout(callback, 0);
  window.cancelAnimationFrame = (handle) => window.clearTimeout(handle);
});

afterEach(cleanup);

describe("Adventure CoverPhotoSheet", () => {
  it("retains Automatic, category presets, and the custom URL field", async () => {
    const onSave = vi.fn().mockResolvedValue(undefined);
    render(
      <CoverPhotoSheet
        adventure={{ id: "adventure-id", category: "outdoors" }}
        onClose={vi.fn()}
        onSave={onSave}
      />,
    );

    expect(screen.getByRole("button", { name: /Automatic/ })).toBeTruthy();
    expect(screen.getAllByRole("button", { name: /^Use .* cover$/ })).toHaveLength(9);
    expect(screen.getByLabelText("Custom image URL")).toBeTruthy();

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
    expect(screen.getAllByRole("button", { name: /^Use .* cover$/ })).toHaveLength(9);
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

    fireEvent.click(screen.getByRole("button", { name: /Automatic/ }));
    fireEvent.click(screen.getByRole("button", { name: "Save cover" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({}));
  });
});
