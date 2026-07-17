import { describe, expect, it } from "vitest";
import { normalizeIdeaUrl, safeIdeaUrl } from "./idea-url";

describe("Idea URL normalization", () => {
  it("allows an empty optional value", () => {
    expect(normalizeIdeaUrl("   ")).toEqual({ url: undefined, error: null });
  });

  it("trims and preserves valid web URLs", () => {
    expect(normalizeIdeaUrl("  https://example.com/path?q=one#details  ")).toEqual({
      url: "https://example.com/path?q=one#details",
      error: null,
    });
    expect(normalizeIdeaUrl("http://example.com").url).toBe("http://example.com");
  });

  it("adds https to domain-style entries", () => {
    expect(normalizeIdeaUrl("example.com").url).toBe("https://example.com");
    expect(normalizeIdeaUrl("www.example.com/path?q=one").url).toBe(
      "https://www.example.com/path?q=one",
    );
  });

  it("rejects unsafe protocols and malformed values", () => {
    for (const value of [
      "javascript:alert(1)",
      "data:text/html,test",
      "file:///tmp/test",
      "not a link",
      "example",
    ]) {
      expect(normalizeIdeaUrl(value).error).toBeTruthy();
      expect(safeIdeaUrl(value)).toBeUndefined();
    }
  });
});
