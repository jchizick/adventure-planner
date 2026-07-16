const AUTH_QUERY_PARAMS = [
  "code",
  "error",
  "error_code",
  "error_description",
];
const AUTH_HASH_PARAMS = [
  "access_token",
  "refresh_token",
  "expires_at",
  "expires_in",
  "provider_token",
  "token_type",
  "type",
  ...AUTH_QUERY_PARAMS,
];

export function cleanAuthCallbackUrl(location: Pick<Location, "href">) {
  const url = new URL(location.href);
  let changed = false;
  for (const key of AUTH_QUERY_PARAMS) {
    if (url.searchParams.has(key)) {
      url.searchParams.delete(key);
      changed = true;
    }
  }
  const hash = new URLSearchParams(url.hash.slice(1));
  for (const key of AUTH_HASH_PARAMS) {
    if (hash.has(key)) {
      hash.delete(key);
      changed = true;
    }
  }
  url.hash = hash.toString() ? `#${hash.toString()}` : "";
  return changed ? `${url.pathname}${url.search}${url.hash}` : null;
}
