import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.2";
import {
  buildGeoapifyAutocompleteUrl,
  MalformedGeoapifyResponseError,
  normalizeGeoapifyResponse,
  type LocationBias,
} from "./geoapify.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
};
const PROVIDER_TIMEOUT_MS = 7000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

function safeError(
  code: string,
  message: string,
  status: number,
  retryable = false,
) {
  return json({ error: { code, message, retryable } }, status);
}

function publishableKeyFromEnvironment() {
  const direct =
    Deno.env.get("SUPABASE_ANON_KEY") ??
    Deno.env.get("SUPABASE_PUBLISHABLE_KEY");
  if (direct) return direct;
  try {
    const keys = JSON.parse(
      Deno.env.get("SUPABASE_PUBLISHABLE_KEYS") ?? "{}",
    ) as Record<string, string>;
    return keys.default ?? Object.values(keys)[0] ?? null;
  } catch {
    return null;
  }
}

function validCoordinatePair(latitude: unknown, longitude: unknown) {
  return (
    typeof latitude === "number" &&
    Number.isFinite(latitude) &&
    latitude >= -90 &&
    latitude <= 90 &&
    typeof longitude === "number" &&
    Number.isFinite(longitude) &&
    longitude >= -180 &&
    longitude <= 180
  );
}

async function geoapifyJson(url: URL, requestSignal: AbortSignal) {
  const controller = new AbortController();
  const abortForCaller = () => controller.abort(requestSignal.reason);
  requestSignal.addEventListener("abort", abortForCaller, { once: true });
  const timeout = setTimeout(
    () => controller.abort(new DOMException("Provider timeout", "TimeoutError")),
    PROVIDER_TIMEOUT_MS,
  );
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (response.status === 429)
      throw new ProviderRequestError("provider_quota", 503);
    if (!response.ok)
      throw new ProviderRequestError("provider_unavailable", 502);
    try {
      return await response.json();
    } catch {
      throw new MalformedGeoapifyResponseError();
    }
  } catch (error) {
    if (
      controller.signal.aborted &&
      !requestSignal.aborted &&
      !(error instanceof ProviderRequestError)
    )
      throw new ProviderRequestError("provider_timeout", 504);
    throw error;
  } finally {
    clearTimeout(timeout);
    requestSignal.removeEventListener("abort", abortForCaller);
  }
}

class ProviderRequestError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
  ) {
    super(code);
  }
}

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return safeError("method_not_allowed", "Method not allowed.", 405);

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = publishableKeyFromEnvironment();
  const geoapifyKey = Deno.env.get("GEOAPIFY_GEOCODING_KEY");
  if (!authorization)
    return safeError(
      "authentication_required",
      "Authentication required.",
      401,
    );
  if (!supabaseUrl || !publishableKey || !geoapifyKey)
    return safeError(
      "configuration_error",
      "Location search is not configured.",
      500,
    );

  let body: {
    spaceId?: unknown;
    query?: unknown;
    adventureId?: unknown;
  };
  try {
    body = await request.json();
  } catch {
    return safeError("invalid_request", "Invalid request.", 400);
  }
  if (
    typeof body.spaceId !== "string" ||
    !body.spaceId.trim() ||
    typeof body.query !== "string" ||
    (body.adventureId !== undefined &&
      (typeof body.adventureId !== "string" || !body.adventureId.trim()))
  )
    return safeError(
      "invalid_request",
      "Location search details are incomplete.",
      400,
    );
  const spaceId = body.spaceId.trim();
  const adventureId =
    typeof body.adventureId === "string" ? body.adventureId.trim() : undefined;
  const query = body.query.trim();
  if (query.length < 3 || query.length > 200)
    return safeError(
      "invalid_query",
      "Enter between 3 and 200 characters.",
      400,
    );

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user)
    return safeError(
      "authentication_required",
      "Authentication required.",
      401,
    );

  const { data: space, error: spaceError } = await client
    .from("spaces")
    .select("id")
    .eq("id", spaceId)
    .maybeSingle();
  if (spaceError || !space)
    return safeError("space_not_found", "Space not found.", 404);

  let bias: LocationBias | undefined;
  if (adventureId) {
    const { data: adventure, error: adventureError } = await client
      .from("adventures")
      .select("id, latitude, longitude")
      .eq("id", adventureId)
      .eq("space_id", spaceId)
      .maybeSingle();
    if (adventureError || !adventure)
      return safeError("adventure_not_found", "Adventure not found.", 404);
    if (validCoordinatePair(adventure.latitude, adventure.longitude)) {
      bias = {
        latitude: adventure.latitude as number,
        longitude: adventure.longitude as number,
      };
    }
  }

  try {
    const payload = await geoapifyJson(
      buildGeoapifyAutocompleteUrl(query, geoapifyKey, bias),
      request.signal,
    );
    return json({ candidates: normalizeGeoapifyResponse(payload) });
  } catch (error) {
    if (request.signal.aborted) return new Response(null, { status: 499 });
    if (error instanceof ProviderRequestError) {
      console.error("Geoapify location search failed", { stage: error.code });
      return safeError(
        error.code,
        "Location search is temporarily unavailable.",
        error.status,
        true,
      );
    }
    if (error instanceof MalformedGeoapifyResponseError) {
      console.error("Geoapify location search failed", {
        stage: "malformed_response",
      });
      return safeError(
        "provider_malformed_response",
        "Location search is temporarily unavailable.",
        502,
        true,
      );
    }
    console.error("Geoapify location search failed", { stage: "network" });
    return safeError(
      "provider_unavailable",
      "Location search is temporarily unavailable.",
      502,
      true,
    );
  }
});
