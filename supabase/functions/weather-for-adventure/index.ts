import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.110.2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, apikey, content-type, x-client-info",
};
const FORECAST_DAYS = 16;
const PROVIDER_TIMEOUT_MS = 9000;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

type AdventureRow = {
  id: string;
  location: string | null;
  latitude: number | null;
  longitude: number | null;
  timezone: string | null;
  event_date: string;
  start_time: string | null;
  end_time: string | null;
  status: "tentative" | "confirmed" | "completed";
  completed_at: string | null;
  updated_at: string;
};

type WeatherPayload =
  | {
      status: "forecast";
      weatherCode: number;
      temperatureC: number;
      apparentTemperatureC: number | null;
      precipitationProbability: number | null;
      windSpeedKph: number | null;
      label: string;
      sourceTime: string;
      updatedAt: string;
    }
  | {
      status: "historical";
      weatherCode: number;
      temperatureC: number;
      apparentTemperatureC: number | null;
      precipitationMm: number | null;
      windSpeedKph: number | null;
      label: string;
      sourceTime: string;
      updatedAt: string;
    }
  | { status: "too-early"; availableFrom: string }
  | { status: "missing-location" }
  | { status: "missing-coordinates" }
  | { status: "missing-time" }
  | { status: "invalid-timezone" }
  | { status: "provider-unavailable" }
  | { status: "no-hourly-match" }
  | { status: "unavailable"; message?: string };

type HourlyResponse = {
  hourly?: {
    time?: unknown;
    temperature_2m?: unknown;
    apparent_temperature?: unknown;
    precipitation_probability?: unknown;
    precipitation?: unknown;
    weather_code?: unknown;
    wind_speed_10m?: unknown;
  };
};

function weatherLabel(code: number) {
  if (code === 0) return "Clear sky";
  if (code === 1) return "Mainly clear";
  if (code === 2) return "Partly cloudy";
  if (code === 3) return "Overcast";
  if (code === 45 || code === 48) return "Fog";
  if ([51, 53, 55, 56, 57].includes(code)) return "Drizzle";
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code)) return "Rain";
  if ([71, 73, 75, 77, 85, 86].includes(code)) return "Snow";
  if ([95, 96, 99].includes(code)) return "Thunderstorm";
  return "Weather conditions";
}

function validTimeZone(timeZone: string) {
  try {
    new Intl.DateTimeFormat("en-CA", { timeZone }).format(new Date());
    return true;
  } catch {
    return false;
  }
}

function localNowKey(timeZone: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(new Date());
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? "";
  return `${part("year")}-${part("month")}-${part("day")}T${part("hour")}:${part("minute")}`;
}

function addDays(date: string, days: number) {
  const value = new Date(`${date}T12:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function dayDifference(from: string, to: string) {
  return Math.round(
    (Date.parse(`${to}T12:00:00Z`) - Date.parse(`${from}T12:00:00Z`)) /
      86_400_000,
  );
}

function nullableNumber(value: unknown) {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function numericArray(value: unknown) {
  return Array.isArray(value) ? value : [];
}

function closestHourlyIndex(times: string[], startTime: string) {
  const [hours, minutes] = startTime.split(":").map(Number);
  const targetMinutes = hours * 60 + minutes;
  let bestIndex = -1;
  let bestDistance = Number.POSITIVE_INFINITY;
  times.forEach((time, index) => {
    const match = /T(\d{2}):(\d{2})$/.exec(time);
    if (!match) return;
    const distance = Math.abs(
      Number(match[1]) * 60 + Number(match[2]) - targetMinutes,
    );
    if (distance < bestDistance) {
      bestDistance = distance;
      bestIndex = index;
    }
  });
  return bestIndex;
}

function normalizeHourly(
  provider: HourlyResponse,
  startTime: string,
  mode: "forecast" | "historical",
  updatedAt: string,
): WeatherPayload | null {
  const hourly = provider.hourly;
  const times = Array.isArray(hourly?.time)
    ? hourly.time.filter((value): value is string => typeof value === "string")
    : [];
  const index = closestHourlyIndex(times, startTime);
  if (index < 0) return null;
  const temperature = nullableNumber(
    numericArray(hourly?.temperature_2m)[index],
  );
  const weatherCode = nullableNumber(numericArray(hourly?.weather_code)[index]);
  if (temperature === null || weatherCode === null) return null;
  const common = {
    weatherCode,
    temperatureC: temperature,
    apparentTemperatureC: nullableNumber(
      numericArray(hourly?.apparent_temperature)[index],
    ),
    windSpeedKph: nullableNumber(numericArray(hourly?.wind_speed_10m)[index]),
    label: weatherLabel(weatherCode),
    sourceTime: times[index],
    updatedAt,
  };
  return mode === "forecast"
    ? {
        status: "forecast",
        ...common,
        precipitationProbability: nullableNumber(
          numericArray(hourly?.precipitation_probability)[index],
        ),
      }
    : {
        status: "historical",
        ...common,
        precipitationMm: nullableNumber(
          numericArray(hourly?.precipitation)[index],
        ),
      };
}

async function providerJson(url: URL) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), PROVIDER_TIMEOUT_MS);
  try {
    const response = await fetch(url, { signal: controller.signal });
    if (!response.ok) throw new Error(`provider status ${response.status}`);
    return (await response.json()) as HourlyResponse;
  } finally {
    clearTimeout(timeout);
  }
}

function adminKeyFromEnvironment() {
  const direct =
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ??
    Deno.env.get("SUPABASE_SECRET_KEY");
  if (direct) return direct;
  try {
    const keys = JSON.parse(
      Deno.env.get("SUPABASE_SECRET_KEYS") ?? "{}",
    ) as Record<string, string>;
    return keys.default ?? Object.values(keys)[0] ?? null;
  } catch {
    return null;
  }
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

async function fingerprint(adventure: AdventureRow, mode: string) {
  const source = [
    adventure.id,
    adventure.latitude,
    adventure.longitude,
    adventure.timezone,
    adventure.event_date,
    adventure.start_time,
    adventure.end_time,
    adventure.status,
    adventure.completed_at,
    mode,
  ].join("|");
  const digest = await crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(source),
  );
  return Array.from(new Uint8Array(digest), (byte) =>
    byte.toString(16).padStart(2, "0"),
  ).join("");
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

  let body: { adventureId?: unknown };
  try {
    body = await request.json();
  } catch {
    return json({ error: "Invalid request." }, 400);
  }
  if (typeof body.adventureId !== "string" || !body.adventureId)
    return json({ error: "Adventure ID is required." }, 400);

  const client = createClient(supabaseUrl, publishableKey, {
    global: { headers: { Authorization: authorization } },
  });
  const {
    data: { user },
    error: userError,
  } = await client.auth.getUser();
  if (userError || !user)
    return json({ error: "Authentication required." }, 401);

  const { data, error } = await client
    .from("adventures")
    .select(
      "id, location, latitude, longitude, timezone, event_date, start_time, end_time, status, completed_at, updated_at",
    )
    .eq("id", body.adventureId)
    .maybeSingle();
  if (error || !data) return json({ error: "Adventure not found." }, 404);
  const adventure = data as AdventureRow;
  if (!adventure.location?.trim())
    return json({ status: "missing-location" } satisfies WeatherPayload);
  if (
    adventure.latitude === null ||
    adventure.longitude === null ||
    !adventure.timezone
  )
    return json({ status: "missing-coordinates" } satisfies WeatherPayload);
  if (!adventure.start_time)
    return json({ status: "missing-time" } satisfies WeatherPayload);
  if (!validTimeZone(adventure.timezone))
    return json({ status: "invalid-timezone" } satisfies WeatherPayload);

  const startTime = adventure.start_time.slice(0, 5);
  const targetKey = `${adventure.event_date}T${startTime}`;
  const nowKey = localNowKey(adventure.timezone);
  const today = nowKey.slice(0, 10);
  const completedFuture =
    adventure.status === "completed" && targetKey > nowKey;
  if (completedFuture)
    return json({
      status: "unavailable",
      message: "Historical weather is not available before the scheduled time.",
    } satisfies WeatherPayload);

  const mode =
    targetKey <= nowKey || adventure.status === "completed"
      ? "historical"
      : dayDifference(today, adventure.event_date) >= FORECAST_DAYS
        ? "too-early"
        : "forecast";
  const requestFingerprint = await fingerprint(adventure, mode);
  const adminKey = adminKeyFromEnvironment();
  const admin = adminKey ? createClient(supabaseUrl, adminKey) : null;

  if (admin) {
    const { data: cached } = await admin
      .from("adventure_weather_cache")
      .select("payload")
      .eq("adventure_id", adventure.id)
      .eq("request_fingerprint", requestFingerprint)
      .gt("expires_at", new Date().toISOString())
      .maybeSingle();
    if (cached?.payload) return json(cached.payload as WeatherPayload);
  }

  const fetchedAt = new Date().toISOString();
  let payload: WeatherPayload;
  let ttlHours: number;
  try {
    if (mode === "too-early") {
      payload = {
        status: "too-early",
        availableFrom: addDays(adventure.event_date, -(FORECAST_DAYS - 1)),
      };
      ttlHours = 12;
    } else {
      const endpoint =
        mode === "forecast"
          ? "https://api.open-meteo.com/v1/forecast"
          : "https://archive-api.open-meteo.com/v1/archive";
      const url = new URL(endpoint);
      url.searchParams.set("latitude", String(adventure.latitude));
      url.searchParams.set("longitude", String(adventure.longitude));
      url.searchParams.set("timezone", adventure.timezone);
      url.searchParams.set("start_date", adventure.event_date);
      url.searchParams.set("end_date", adventure.event_date);
      url.searchParams.set(
        "hourly",
        mode === "forecast"
          ? "temperature_2m,apparent_temperature,precipitation_probability,weather_code,wind_speed_10m"
          : "temperature_2m,apparent_temperature,precipitation,weather_code,wind_speed_10m",
      );
      url.searchParams.set("temperature_unit", "celsius");
      url.searchParams.set("wind_speed_unit", "kmh");
      url.searchParams.set("precipitation_unit", "mm");
      const normalized = normalizeHourly(
        await providerJson(url),
        adventure.start_time,
        mode,
        fetchedAt,
      );
      if (!normalized)
        return json({ status: "no-hourly-match" } satisfies WeatherPayload);
      payload = normalized;
      const daysAway = dayDifference(today, adventure.event_date);
      ttlHours =
        mode === "historical"
          ? 24 * 3650
          : daysAway === 0
            ? 1
            : daysAway <= 7
              ? 3
              : 12;
    }
  } catch (providerError) {
    console.error(
      "Open-Meteo weather request failed",
      adventure.id,
      providerError instanceof Error ? providerError.message : providerError,
    );
    return json({ status: "provider-unavailable" } satisfies WeatherPayload);
  }

  if (admin) {
    const expiresAt = new Date(Date.now() + ttlHours * 3_600_000).toISOString();
    const { error: cacheError } = await admin
      .from("adventure_weather_cache")
      .upsert({
        adventure_id: adventure.id,
        mode,
        target_time: targetKey,
        request_fingerprint: requestFingerprint,
        payload,
        provider: "open-meteo",
        fetched_at: fetchedAt,
        expires_at: expiresAt,
        updated_at: fetchedAt,
      });
    if (cacheError)
      console.error("Weather cache write failed", cacheError.message);
  } else {
    console.warn("Weather cache disabled: no server secret key is configured");
  }

  return json(payload);
});
