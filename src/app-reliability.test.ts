import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");

describe("mobile and session reliability configuration", () => {
  it("launches the standalone app from the canonical root", () => {
    const manifest = JSON.parse(read("../public/site.webmanifest"));
    expect(manifest).toMatchObject({ start_url: "/", scope: "/", display: "standalone" });
    expect(read("../index.html")).toContain('href="/site.webmanifest"');
  });

  it("uses persistent Supabase sessions without a service worker reload path", () => {
    const client = read("./lib/supabase.ts");
    expect(client).toContain("persistSession: true");
    expect(client).toContain("autoRefreshToken: true");
    expect(client).toContain("detectSessionInUrl: true");
    expect(read("./main.tsx")).not.toMatch(/serviceWorker|location\.reload/);
  });

  it("keys workspace initial loading to stable user identity", () => {
    const workspace = read("./workspace.tsx");
    expect(workspace).toContain("const userId = user?.id");
    expect(workspace).toContain("}, [userId]);");
  });

  it("explains email-bound shared-space and invitation access", () => {
    const authUi = read("./auth-ui.tsx");
    expect(authUi).toContain(
      "Invitations and shared spaces are tied to your email.",
    );
    expect(authUi).toContain(
      "Use the email address that received your invitation.",
    );
  });
});
