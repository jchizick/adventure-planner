// @vitest-environment jsdom

import { cleanup, fireEvent, render } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { IdeaCoverThumbnail } from "./idea-cover-thumbnail";
import type { Idea } from "./types";

const idea: Idea = {
  id: "dinner-idea",
  title: "Restaurant dinner",
  description: "Try somewhere new",
  category: "food-drink",
  status: "Idea",
  tags: [],
  addedBy: "Member",
  isDateNight: false,
  createdAt: "2026-07-15",
};

afterEach(cleanup);

describe("IdeaCoverThumbnail", () => {
  it("renders a reserved, lazy, decorative cover crop", () => {
    const { container } = render(<IdeaCoverThumbnail idea={idea} size={64} />);
    const wrapper = container.querySelector<HTMLElement>(
      ".idea-cover-thumbnail",
    )!;
    const image = container.querySelector<HTMLImageElement>("img")!;

    expect(wrapper.style.width).toBe("64px");
    expect(wrapper.style.height).toBe("64px");
    expect(wrapper.dataset.ideaCoverPreset).toBe("food-dinner");
    expect(image.getAttribute("alt")).toBe("");
    expect(image.getAttribute("loading")).toBe("lazy");
    expect(image.getAttribute("width")).toBe("64");
    expect(image.getAttribute("height")).toBe("64");
  });

  it("falls back to the general cover and hides a failed fallback", () => {
    const { container } = render(<IdeaCoverThumbnail idea={idea} size={58} />);
    const image = container.querySelector<HTMLImageElement>("img")!;
    expect(image.getAttribute("src")).toBe(
      "/category-art/covers/food-drink/02.webp",
    );

    fireEvent.error(image);
    expect(image.getAttribute("src")).toBe(
      "/category-art/generic/adventure-cover.webp",
    );
    fireEvent.error(image);
    expect(image.style.visibility).toBe("hidden");
  });
});
