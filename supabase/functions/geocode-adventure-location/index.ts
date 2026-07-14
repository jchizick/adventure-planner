import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type GeocodingResult = {
  name?: unknown;
  latitude?: unknown;
  longitude?: unknown;
  timezone?: unknown;
  admin1?: unknown;
  country?: unknown;
};

const textPart = (value: unknown) =>
  typeof value === "string" && value.trim() ? value.trim() : null;

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

Deno.serve(async (request) => {
  if (request.method === "OPTIONS")
    return new Response("ok", { headers: corsHeaders });
  if (request.method !== "POST")
    return json({ error: "Method not allowed." }, 405);

  const authorization = request.headers.get("Authorization");
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const publishableKey = publishableKeyFromEnvironment();
  if (!authorization) return json({ error: "Authentication required." }, 401);
  if (!supabaseUrl || !publishableKey)
    return json({ error: "Function configuration is incomplete." }, 500);

  let body: { spaceId?: unknown; query?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (typeof body.spaceId !== "string" || typeof body.query !== "string")
    return json({ error: "Location details are incomplete." }, 400);
  const query = body.query.trim();
  if (query.length < 2 || query.length > 240)
    return json({ error: "Enter a valid location." }, 400);

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  });
  const { data: membership, error: membershipError } = await client
    .from("space_members")
    .select("space_id")
    .eq("space_id", body.spaceId)
    .maybeSingle();
  if (membershipError || !membership)
    return json({ error: "Space not found." }, 403);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 7000);
  try {
    const fallbackQuery = query.includes(",")
      ? query.split(",").slice(1).join(",").trim()
      : "";
    const searches = [
      ...new Set([query, fallbackQuery].filter((value) => value.length >= 2)),
    ];
    let match: GeocodingResult | undefined;
    for (const search of searches) {
      const url = new URL("https://geocoding-api.open-meteo.com/v1/search");
      url.searchParams.set("name", search);
      url.searchParams.set("count", "5");
      url.searchParams.set("language", "en");
      url.searchParams.set("format", "json");
      const response = await fetch(url, { signal: controller.signal });
      if (!response.ok) {
        console.error("Open-Meteo geocoding failed", response.status);
        return json({ error: "Location lookup is unavailable." }, 502);
      }
      const provider = (await response.json()) as {
        results?: GeocodingResult[];
      };
      match = provider.results?.find(
        (candidate) =>
          typeof candidate.latitude === "number" &&
          Number.isFinite(candidate.latitude) &&
          typeof candidate.longitude === "number" &&
          Number.isFinite(candidate.longitude) &&
          typeof candidate.timezone === "string" &&
          candidate.timezone.length > 0,
      );
      if (match) break;
    }
    if (!match) return json({ result: null });
    const label = [
      textPart(match.name),
      textPart(match.admin1),
      textPart(match.country),
    ]
      .filter((part, index, parts) => part && parts.indexOf(part) === index)
      .join(", ");
    return json({
      result: {
        latitude: match.latitude,
        longitude: match.longitude,
        timezone: match.timezone,
        normalizedLocation: label || query,
      },
    });
  } catch (error) {
    console.error(
      "Location lookup exception",
      error instanceof Error ? error.message : error,
    );
    return json({ error: "Location lookup is unavailable." }, 502);
  } finally {
    clearTimeout(timeout);
  }
});
