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
    expect(screen.getAllByRole("button", { name: /Use category cover/ })).toHaveLength(3);
    expect(screen.getByLabelText("Custom image URL")).toBeTruthy();

    fireEvent.click(screen.getByRole("button", { name: "Use category cover 2" }));
    fireEvent.click(screen.getByRole("button", { name: "Save cover" }));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith({ coverVariant: 2 }));
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
