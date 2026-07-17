// @vitest-environment jsdom

import { describe, expect, it, vi } from "vitest";
import {
  constrainedCoverDimensions,
  coverStoragePath,
  MAX_COVER_IMAGE_BYTES,
  validateCoverFile,
} from "./cover-storage";

function imageFile(name: string, type: string, size = 4) {
  return new File([new Uint8Array(size)], name, { type });
}

describe("cover upload validation and processing geometry", () => {
  it.each([
    ["cover.jpg", "image/jpeg"],
    ["cover.png", "image/png"],
    ["cover.webp", "image/webp"],
  ])("accepts %s", (name, type) => {
    expect(validateCoverFile(imageFile(name, type))).toBe(type);
  });

  it("rejects unsupported, empty, oversized, and mismatched files", () => {
    expect(() => validateCoverFile(imageFile("cover.svg", "image/svg+xml")))
      .toThrow("JPEG, PNG, or WebP");
    expect(() => validateCoverFile(new File([], "cover.jpg", { type: "image/jpeg" })))
      .toThrow("non-empty");
    const oversized = { name: "cover.jpg", type: "image/jpeg", size: MAX_COVER_IMAGE_BYTES + 1 } as File;
    expect(() => validateCoverFile(oversized)).toThrow("smaller than 10 MB");
    expect(() => validateCoverFile(imageFile("cover.png", "image/jpeg")))
      .toThrow("does not match");
  });

  it("preserves aspect ratio while constraining the longest edge", () => {
    expect(constrainedCoverDimensions(4000, 2000)).toEqual({ width: 1800, height: 900 });
    expect(constrainedCoverDimensions(900, 1600)).toEqual({ width: 900, height: 1600 });
  });

  it("generates a scoped path without using the source filename", () => {
    vi.spyOn(globalThis.crypto, "randomUUID").mockReturnValue("00000000-0000-4000-8000-000000000003");
    expect(coverStoragePath("space-id", "ideas", "idea-id")).toBe(
      "spaces/space-id/ideas/idea-id/cover/00000000-0000-4000-8000-000000000003.jpg",
    );
  });
});
