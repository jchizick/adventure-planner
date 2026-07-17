export type NormalizedIdeaUrl =
  | { url: undefined; error: null }
  | { url: string; error: null }
  | { url: undefined; error: string };

const URL_SCHEME = /^[a-z][a-z\d+.-]*:/i;
const DOMAIN_HOST = /^(?:localhost|(?:[a-z\d](?:[a-z\d-]{0,61}[a-z\d])?\.)+[a-z]{2,63}|\d{1,3}(?:\.\d{1,3}){3})$/i;

export function normalizeIdeaUrl(value: string | null | undefined): NormalizedIdeaUrl {
  const trimmed = value?.trim() ?? "";
  if (!trimmed) return { url: undefined, error: null };
  if (/\s/.test(trimmed)) {
    return { url: undefined, error: "Enter a valid website or link." };
  }

  const hasScheme = URL_SCHEME.test(trimmed);
  const candidate = hasScheme ? trimmed : `https://${trimmed}`;
  try {
    const parsed = new URL(candidate);
    if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
      return { url: undefined, error: "Use an http:// or https:// link." };
    }
    if (!DOMAIN_HOST.test(parsed.hostname)) {
      return { url: undefined, error: "Enter a valid website or link." };
    }
    return { url: candidate, error: null };
  } catch {
    return { url: undefined, error: "Enter a valid website or link." };
  }
}

export function safeIdeaUrl(value: string | null | undefined) {
  const result = normalizeIdeaUrl(value);
  return result.error ? undefined : result.url;
}
