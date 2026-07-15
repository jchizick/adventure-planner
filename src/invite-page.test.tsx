// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const styles = readFileSync(join(process.cwd(), "src", "styles.css"), "utf8");

const invitation = {
  id: "invitation-id",
  spaceId: "space-id",
  spaceName:
    "Our Very Long Shared Adventure Space Name That Still Needs to Wrap Readably",
  inviterName: "Adventure Partner",
  invitedEmail:
    "a-very-long-invitation-address-that-needs-to-wrap@example.test",
  expiresAt: "2026-07-22T12:00:00.000Z",
  status: "pending" as const,
};

const { loadInvitation, acceptInvitation, refreshMemberships } = vi.hoisted(
  () => ({
    loadInvitation: vi.fn(),
    acceptInvitation: vi.fn(),
    refreshMemberships: vi.fn(),
  }),
);

vi.mock("./auth", () => ({
  useAuth: () => ({ loading: false, user: { id: "user-id" } }),
}));

vi.mock("./workspace", () => ({
  useWorkspace: () => ({
    profile: { id: "user-id", displayName: "Invitee" },
    loading: false,
    error: null,
    refreshMemberships,
  }),
}));

vi.mock("./repositories/invitations", () => ({
  acceptInvitation,
  createSpaceInvitation: vi.fn(),
  loadInvitation,
  loadSpaceInvitations: vi.fn(),
  loadSpaceMembers: vi.fn(),
  removeMember: vi.fn(),
  revokeInvitation: vi.fn(),
}));

import { InvitePage } from "./members";

function renderInvitePage() {
  return render(
    <MemoryRouter initialEntries={["/invite/raw-token"]}>
      <Routes>
        <Route path="/invite/:token" element={<InvitePage />} />
      </Routes>
    </MemoryRouter>,
  );
}

beforeEach(() => {
  loadInvitation.mockReset().mockResolvedValue(invitation);
  acceptInvitation.mockReset();
  refreshMemberships.mockReset();
});

afterEach(cleanup);

describe("InvitePage", () => {
  it("renders long invitation details in the semantic two-column summary", async () => {
    renderInvitePage();

    expect(
      await screen.findByRole("heading", { name: `Join ${invitation.spaceName}` }),
    ).toBeTruthy();
    expect(screen.getByText(new RegExp(invitation.invitedEmail))).toBeTruthy();

    const summary = screen.getByText("Status").closest("dl");
    expect(summary?.classList.contains("invitation-summary")).toBe(true);
    expect(summary?.querySelectorAll(":scope > div")).toHaveLength(2);
    expect(screen.getByText("Expires")).toBeTruthy();
  });

  it("preserves the disabled loading state while acceptance is pending", async () => {
    acceptInvitation.mockReturnValue(new Promise(() => undefined));
    renderInvitePage();

    const button = await screen.findByRole("button", {
      name: "Accept invitation",
    });
    fireEvent.click(button);

    expect(acceptInvitation).toHaveBeenCalledOnce();
    expect(acceptInvitation).toHaveBeenCalledWith("raw-token");
    expect(
      (screen.getByRole("button", {
        name: "Joining space…",
      }) as HTMLButtonElement).disabled,
    ).toBe(true);
  });

  it("keeps the CTA single-line and full width on mobile", () => {
    expect(styles).toMatch(
      /\.invite-card \.access-primary\s*{[^}]*min-height:\s*50px;[^}]*padding:\s*0 28px;[^}]*white-space:\s*nowrap;/s,
    );
    expect(styles).toMatch(
      /@media \(max-width: 600px\)[\s\S]*?\.invite-card \.access-primary\s*{\s*width:\s*100%;\s*}/,
    );
  });

  it("allows long space names, emails, and summary values to wrap", () => {
    expect(styles).toMatch(
      /\.invite-card \.access-copy h1,[\s\S]*?overflow-wrap:\s*anywhere;/,
    );
    expect(styles).toMatch(
      /\.invitation-summary dd\s*{[^}]*overflow-wrap:\s*anywhere;/s,
    );
  });
});
