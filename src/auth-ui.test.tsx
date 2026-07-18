// @vitest-environment jsdom

import { cleanup, fireEvent, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { authState, clearCallbackError, sendMagicLink } = vi.hoisted(() => ({
  authState: { callbackError: null as string | null },
  clearCallbackError: vi.fn(),
  sendMagicLink: vi.fn(),
}));

function setMediaMatches({
  mobile = false,
  reducedMotion = false,
}: {
  mobile?: boolean;
  reducedMotion?: boolean;
} = {}) {
  window.matchMedia = vi.fn((query: string) =>
    ({
      matches:
        (query === "(max-width: 1100px)" && mobile) ||
        (query === "(prefers-reduced-motion: reduce)" && reducedMotion),
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }) satisfies MediaQueryList,
  );
}

vi.mock("./auth", () => ({
  useAuth: () => ({
    callbackError: authState.callbackError,
    clearCallbackError,
    sendMagicLink,
  }),
}));

vi.mock("./workspace", () => ({
  useWorkspace: vi.fn(),
}));

import { SignInScreen } from "./auth-ui";

beforeEach(() => {
  authState.callbackError = null;
  clearCallbackError.mockReset();
  sendMagicLink.mockReset().mockResolvedValue(undefined);
  HTMLElement.prototype.scrollIntoView = vi.fn();
  setMediaMatches();
});

afterEach(cleanup);

describe("SignInScreen", () => {
  it("renders the welcome story, workflow, accessible mobile details, and one form", () => {
    const { container } = render(<SignInScreen />);

    expect(
      screen.getByRole("heading", {
        level: 1,
        name: /Plan it together\.\s*Live it together\.\s*Remember it all\./,
      }),
    ).toBeTruthy();
    expect(
      screen.getByText(
        "A private shared space for saving ideas, planning adventures, organizing every stop, and keeping the memories afterward.",
      ),
    ).toBeTruthy();

    const workflow = container.querySelector(".welcome-workflow");
    expect(workflow).toBeTruthy();
    expect(workflow?.querySelectorAll(".welcome-workflow-stage")).toHaveLength(4);
    const connectors = workflow?.querySelectorAll(".welcome-workflow-connector");
    expect(connectors).toHaveLength(3);
    connectors?.forEach((connector) => {
      expect(connector.getAttribute("aria-hidden")).toBe("true");
    });
    for (const stage of ["Ideas", "Adventure", "Itinerary", "Memories"]) {
      expect(
        within(workflow as HTMLElement).getByRole("heading", { name: stage }),
      ).toBeTruthy();
    }

    const detailsSummary = screen.getByText("How it works");
    const details = detailsSummary.closest("details");
    expect(details).toBeTruthy();
    expect(container.querySelector(".welcome-workflow-compact")).toBeNull();
    for (const stage of ["Ideas", "Adventure", "Itinerary", "Memories"]) {
      expect(within(details as HTMLElement).getByText(stage)).toBeTruthy();
    }
    for (const description of [
      "Save something you want to do.",
      "Choose the date and details.",
      "Plan the stops together.",
      "Add photos and reflections.",
    ]) {
      expect(within(details as HTMLElement).getByText(description)).toBeTruthy();
    }
    expect(container.querySelectorAll("form")).toHaveLength(1);
    expect(screen.getAllByLabelText("Email address")).toHaveLength(1);
    expect(
      screen.getByText("Invitations and shared spaces are tied to your email."),
    ).toBeTruthy();
  });

  it("targets and focuses the desktop workflow from Learn more", () => {
    const { container } = render(<SignInScreen />);
    const workflow = container.querySelector(".welcome-workflow") as HTMLElement;

    fireEvent.click(
      screen.getByRole("button", {
        name: "Learn more about how Our Adventures works",
      }),
    );

    expect(workflow.scrollIntoView).toHaveBeenCalledWith({
      behavior: "smooth",
      block: "center",
    });
    expect(document.activeElement).toBe(workflow);
  });

  it("expands and focuses mobile How it works from Learn more", () => {
    setMediaMatches({ mobile: true, reducedMotion: true });
    render(<SignInScreen />);
    const summary = screen.getByText("How it works");
    const details = summary.closest("details") as HTMLDetailsElement;

    expect(details.open).toBe(false);
    fireEvent.click(
      screen.getByRole("button", {
        name: "Learn more about how Our Adventures works",
      }),
    );

    expect(details.open).toBe(true);
    expect(summary.scrollIntoView).toHaveBeenCalledWith({
      behavior: "auto",
      block: "center",
    });
    expect(document.activeElement).toBe(summary);
  });

  it("validates the email before requesting a magic link", () => {
    render(<SignInScreen />);

    fireEvent.click(screen.getByRole("button", { name: "Send magic link" }));

    expect(screen.getByRole("alert").textContent).toContain(
      "Enter a valid email address.",
    );
    expect(sendMagicLink).not.toHaveBeenCalled();
    expect(document.activeElement).toBe(screen.getByLabelText("Email address"));
  });

  it("preserves submission arguments and the disabled loading state", async () => {
    sendMagicLink.mockReturnValue(new Promise(() => undefined));
    const user = userEvent.setup();
    render(<SignInScreen />);

    await user.type(screen.getByLabelText("Email address"), "jordan@example.com");
    await user.click(screen.getByRole("button", { name: "Send magic link" }));

    expect(sendMagicLink).toHaveBeenCalledWith("jordan@example.com", "/today");
    const loadingButton = screen.getByRole("button", { name: "Sending…" });
    expect((loadingButton as HTMLButtonElement).disabled).toBe(true);
  });

  it("announces success and recoverable request errors", async () => {
    const user = userEvent.setup();
    const firstRender = render(<SignInScreen />);
    await user.type(screen.getByLabelText("Email address"), "jordan@example.com");
    await user.click(screen.getByRole("button", { name: "Send magic link" }));

    expect((await screen.findByRole("status")).textContent).toContain(
      "We sent a magic link",
    );
    expect(screen.getByText("Check your email")).toBeTruthy();
    expect(screen.getByText("jordan@example.com")).toBeTruthy();

    firstRender.unmount();
    sendMagicLink.mockRejectedValueOnce(new Error("Please try again later."));
    render(<SignInScreen />);
    await user.type(screen.getByLabelText("Email address"), "jordan@example.com");
    await user.click(screen.getByRole("button", { name: "Send magic link" }));

    expect((await screen.findByRole("alert")).textContent).toContain(
      "Please try again later.",
    );
  });

  it("keeps invitation guidance and redirect behavior unchanged", async () => {
    const user = userEvent.setup();
    render(<SignInScreen invitation redirectPath="/invite/raw-token" />);

    expect(
      screen.getByText("Use the email address that received your invitation."),
    ).toBeTruthy();
    await user.type(screen.getByLabelText("Email address"), "invitee@example.com");
    await user.click(screen.getByRole("button", { name: "Send magic link" }));

    expect(sendMagicLink).toHaveBeenCalledWith(
      "invitee@example.com",
      "/invite/raw-token",
    );
  });
});
