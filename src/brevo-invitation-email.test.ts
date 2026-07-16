import { describe, expect, it, vi } from "vitest";
import {
  BREVO_TRANSACTIONAL_EMAIL_URL,
  parseInvitationSender,
  sendBrevoEmail,
} from "../supabase/functions/send-space-invitation/brevo";

const email = {
  apiKey: "brevo-secret-key",
  fromEmail: "Our Adventures <invites@ouradventures.today>",
  to: "invitee@example.com",
  subject: "You’re invited to Our Adventures",
  htmlContent: "<p>Invitation</p>",
  textContent: "Invitation",
};

describe("parseInvitationSender", () => {
  it("uses the configured display name", () => {
    expect(
      parseInvitationSender(
        "Our Adventures <invites@ouradventures.today>",
      ),
    ).toEqual({
      name: "Our Adventures",
      email: "invites@ouradventures.today",
    });
  });

  it("defaults the display name for a plain email address", () => {
    expect(parseInvitationSender("invites@ouradventures.today")).toEqual({
      name: "Our Adventures",
      email: "invites@ouradventures.today",
    });
  });

  it("rejects malformed or header-injected sender values", () => {
    expect(parseInvitationSender("not-an-email")).toBeNull();
    expect(
      parseInvitationSender(
        "Our Adventures <invites@ouradventures.today>\r\nBcc: attacker@example.com",
      ),
    ).toBeNull();
  });
});

describe("sendBrevoEmail", () => {
  it("sends the inline Brevo payload and accepts a successful 2xx response", async () => {
    const fetcher = vi.fn().mockResolvedValue(new Response(null, { status: 201 }));

    await expect(sendBrevoEmail({ ...email, fetcher })).resolves.toEqual({
      delivered: true,
    });
    expect(fetcher).toHaveBeenCalledOnce();

    const [url, init] = fetcher.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(BREVO_TRANSACTIONAL_EMAIL_URL);
    expect(init).toMatchObject({
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": email.apiKey,
        "Content-Type": "application/json",
      },
    });
    expect(JSON.parse(String(init.body))).toEqual({
      sender: {
        name: "Our Adventures",
        email: "invites@ouradventures.today",
      },
      to: [{ email: "invitee@example.com" }],
      subject: email.subject,
      htmlContent: email.htmlContent,
      textContent: email.textContent,
    });
  });

  it("returns a provider failure for a rejected Brevo response", async () => {
    const fetcher = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ code: "unauthorized", message: "Denied" }), {
        status: 401,
      }),
    );

    await expect(sendBrevoEmail({ ...email, fetcher })).resolves.toEqual({
      delivered: false,
      reason: "provider_failure",
      status: 401,
      detail: JSON.stringify({ code: "unauthorized", message: "Denied" }),
    });
  });

  it("does not call Brevo when BREVO_API_KEY is missing", async () => {
    const fetcher = vi.fn();

    await expect(
      sendBrevoEmail({ ...email, apiKey: undefined, fetcher }),
    ).resolves.toEqual({ delivered: false, reason: "not_configured" });
    expect(fetcher).not.toHaveBeenCalled();
  });

  it("redacts the API key and raw invitation token from provider errors", async () => {
    const rawToken = "raw-invitation-token";
    const fetcher = vi.fn().mockResolvedValue(
      new Response(`Rejected ${email.apiKey} for ${rawToken}`, { status: 400 }),
    );

    const result = await sendBrevoEmail({
      ...email,
      sensitiveValues: [rawToken],
      fetcher,
    });

    expect(result).toMatchObject({
      delivered: false,
      reason: "provider_failure",
      status: 400,
    });
    expect(JSON.stringify(result)).not.toContain(email.apiKey);
    expect(JSON.stringify(result)).not.toContain(rawToken);
    expect(JSON.stringify(result)).toContain("[redacted]");
  });
});
