export const BREVO_TRANSACTIONAL_EMAIL_URL =
  "https://api.brevo.com/v3/smtp/email";

export type BrevoSender = {
  name: string;
  email: string;
};

export type BrevoEmailPayload = {
  sender: BrevoSender;
  to: Array<{ email: string }>;
  subject: string;
  htmlContent: string;
  textContent: string;
};

type FetchLike = (
  input: string | URL | Request,
  init?: RequestInit,
) => Promise<Response>;

type SendBrevoEmailOptions = {
  apiKey: string | undefined;
  fromEmail: string | undefined;
  to: string;
  subject: string;
  htmlContent: string;
  textContent: string;
  sensitiveValues?: string[];
  fetcher?: FetchLike;
};

export type BrevoDeliveryResult =
  | { delivered: true }
  | { delivered: false; reason: "not_configured" }
  | {
      delivered: false;
      reason: "provider_failure";
      status: number | null;
      detail: string;
    };

const EMAIL_PATTERN = /^[^\s@<>]+@[^\s@<>]+\.[^\s@<>]+$/;

export function parseInvitationSender(value: string): BrevoSender | null {
  if (/[\r\n]/.test(value)) return null;

  const trimmed = value.trim();
  const displayNameMatch = trimmed.match(/^([^<>]+?)\s*<([^<>]+)>$/);
  const name = displayNameMatch?.[1].trim() ?? "Our Adventures";
  const email = (displayNameMatch?.[2] ?? trimmed).trim();

  if (!name || !EMAIL_PATTERN.test(email)) return null;
  return { name, email };
}

function redactSensitiveValues(value: string, sensitiveValues: string[]) {
  return sensitiveValues
    .filter(Boolean)
    .sort((left, right) => right.length - left.length)
    .reduce(
      (redacted, sensitiveValue) =>
        redacted.replaceAll(sensitiveValue, "[redacted]"),
      value,
    );
}

async function readSafeFailureDetail(
  response: Response,
  sensitiveValues: string[],
) {
  let body: string;
  try {
    body = await response.text();
  } catch {
    return "Brevo returned an unreadable error response.";
  }

  const compactBody = body.replace(/\s+/g, " ").trim().slice(0, 1_000);
  if (!compactBody) return "Brevo returned an empty error response.";
  return redactSensitiveValues(compactBody, sensitiveValues);
}

export async function sendBrevoEmail({
  apiKey,
  fromEmail,
  to,
  subject,
  htmlContent,
  textContent,
  sensitiveValues = [],
  fetcher = fetch,
}: SendBrevoEmailOptions): Promise<BrevoDeliveryResult> {
  const sender = fromEmail ? parseInvitationSender(fromEmail) : null;
  if (!apiKey || !sender) return { delivered: false, reason: "not_configured" };

  const payload: BrevoEmailPayload = {
    sender,
    to: [{ email: to }],
    subject,
    htmlContent,
    textContent,
  };

  let response: Response;
  try {
    response = await fetcher(BREVO_TRANSACTIONAL_EMAIL_URL, {
      method: "POST",
      headers: {
        accept: "application/json",
        "api-key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
  } catch {
    return {
      delivered: false,
      reason: "provider_failure",
      status: null,
      detail: "Brevo request failed before receiving a response.",
    };
  }

  if (response.status >= 200 && response.status < 300)
    return { delivered: true };

  return {
    delivered: false,
    reason: "provider_failure",
    status: response.status,
    detail: await readSafeFailureDetail(response, [apiKey, ...sensitiveValues]),
  };
}
