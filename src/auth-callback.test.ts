import { describe, expect, it } from "vitest";
import { cleanAuthCallbackUrl } from "./auth-callback";

describe("auth callback URL cleanup", () => {
  it("removes temporary callback parameters and preserves application parameters", () => {
    expect(cleanAuthCallbackUrl({ href: "https://example.test/today?code=secret&view=month#access_token=token&type=magiclink" } as Location)).toBe("/today?view=month");
  });

  it("does nothing to a normal route", () => {
    expect(cleanAuthCallbackUrl({ href: "https://example.test/ideas?filter=food" } as Location)).toBeNull();
  });
});
