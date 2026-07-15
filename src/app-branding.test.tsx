// @vitest-environment jsdom

import { cleanup, render, within } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import componentsSource from "./components.tsx?raw";
import memoryDetailSource from "./memory-detail.tsx?raw";
import membersSource from "./members.tsx?raw";
import pagesSource from "./pages.tsx?raw";

vi.mock("./auth", () => ({
  useAuth: () => ({ signOut: vi.fn() }),
}));

vi.mock("./workspace", () => ({
  useWorkspace: () => ({
    activeSpace: { id: "space-id", name: "Jordan & Liz" },
    profile: { displayName: "Jordan" },
  }),
}));

import { AppShell } from "./components";

afterEach(cleanup);

function renderAppShell() {
  return render(
    <MemoryRouter initialEntries={["/today"]}>
      <Routes>
        <Route element={<AppShell />}>
          <Route path="/today" element={<div className="today">Today</div>} />
        </Route>
      </Routes>
    </MemoryRouter>,
  );
}

describe("application branding", () => {
  it("renders the public SVG logo without the shared-space name in the desktop sidebar", () => {
    const { container } = renderAppShell();
    const sidebar = container.querySelector(".desktop-nav");
    expect(sidebar).toBeTruthy();

    const logo = within(sidebar as HTMLElement).getByAltText("Our Adventures");
    expect(logo.getAttribute("src")).toBe("/our-adventures-logo.svg");
    expect(logo.classList.contains("app-logo-desktop")).toBe(true);
    expect(within(sidebar as HTMLElement).queryByText("Jordan & Liz")).toBeNull();
  });

  it("renders the public SVG logo in the mobile header beside its actions", () => {
    const { container } = renderAppShell();
    const mobileHeader = container.querySelector(".mobile-account");
    expect(mobileHeader).toBeTruthy();

    const header = within(mobileHeader as HTMLElement);
    const logo = header.getByAltText("Our Adventures");
    expect(logo.getAttribute("src")).toBe("/our-adventures-logo.svg");
    expect(logo.classList.contains("app-logo-mobile")).toBe(true);
    expect(header.queryByText("Jordan & Liz")).toBeNull();
    expect(header.getByRole("link", { name: "People and invitations" })).toBeTruthy();
    expect(header.getByRole("button", { name: "Sign out" })).toBeTruthy();
  });

  it("owns the single shared mobile header instead of duplicating it in pages", () => {
    expect(componentsSource.match(/className="mobile-account"/g)).toHaveLength(1);
    for (const routeSource of [pagesSource, membersSource, memoryDetailSource]) {
      expect(routeSource).not.toContain('className="mobile-account"');
    }
  });
});
