import {
  Cloud,
  CloudDrizzle,
  CloudFog,
  CloudLightning,
  CloudRain,
  CloudSun,
  RefreshCw,
  Snowflake,
  Sun,
  type LucideIcon,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { supabase } from "./lib/supabase";
import type { Adventure } from "./types";

export type AdventureWeather =
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
  | { status: "location-unconfirmed" }
  | { status: "missing-coordinates" }
  | { status: "missing-time" }
  | { status: "invalid-timezone" }
  | { status: "provider-unavailable" }
  | { status: "no-hourly-match" }
  | { status: "unavailable"; message?: string };

type WeatherPresentation = {
  Icon: LucideIcon;
  label: string;
  tone: "sunny" | "cloudy" | "wet" | "cold" | "storm";
};

export function getWeatherPresentation(code: number): WeatherPresentation {
  if (code === 0) return { Icon: Sun, label: "Clear sky", tone: "sunny" };
  if (code === 1 || code === 2)
    return {
      Icon: CloudSun,
      label: code === 1 ? "Mainly clear" : "Partly cloudy",
      tone: "sunny",
    };
  if (code === 3) return { Icon: Cloud, label: "Overcast", tone: "cloudy" };
  if (code === 45 || code === 48)
    return { Icon: CloudFog, label: "Fog", tone: "cloudy" };
  if ([51, 53, 55, 56, 57].includes(code))
    return { Icon: CloudDrizzle, label: "Drizzle", tone: "wet" };
  if ([61, 63, 65, 66, 67, 80, 81, 82].includes(code))
    return { Icon: CloudRain, label: "Rain", tone: "wet" };
  if ([71, 73, 75, 77, 85, 86].includes(code))
    return { Icon: Snowflake, label: "Snow", tone: "cold" };
  if ([95, 96, 99].includes(code))
    return { Icon: CloudLightning, label: "Thunderstorm", tone: "storm" };
  return { Icon: Cloud, label: "Weather conditions", tone: "cloudy" };
}

function isAdventureWeather(value: unknown): value is AdventureWeather {
  if (!value || typeof value !== "object" || !("status" in value)) return false;
  return [
    "forecast",
    "historical",
    "too-early",
    "missing-location",
    "location-unconfirmed",
    "missing-coordinates",
    "missing-time",
    "invalid-timezone",
    "provider-unavailable",
    "no-hourly-match",
    "unavailable",
  ].includes(String(value.status));
}

async function weatherFromInvocationError(error: unknown) {
  if (!error || typeof error !== "object" || !("context" in error)) return null;
  const context = (error as { context?: unknown }).context;
  if (!(context instanceof Response)) return null;
  try {
    const body: unknown = await context.clone().json();
    return isAdventureWeather(body) ? body : null;
  } catch {
    return null;
  }
}

function weatherFingerprint(adventure: Adventure) {
  return [
    adventure.id,
    adventure.savedLocation.kind,
    adventure.latitude,
    adventure.longitude,
    adventure.timezone,
    adventure.date,
    adventure.startTime,
    adventure.status,
    adventure.completedAt,
  ].join("|");
}

export function localAdventureWeatherState(
  adventure: Adventure,
): AdventureWeather | null {
  if (adventure.savedLocation.kind === "none")
    return { status: "missing-location" };
  if (
    adventure.savedLocation.kind === "text" ||
    adventure.savedLocation.kind === "legacy"
  )
    return { status: "location-unconfirmed" };
  if (
    adventure.latitude === undefined ||
    adventure.longitude === undefined ||
    !adventure.timezone
  )
    return { status: "missing-coordinates" };
  if (!adventure.startTime) return { status: "missing-time" };
  return null;
}

function useAdventureWeather(adventure: Adventure) {
  const [result, setResult] = useState<{
    key: string;
    weather: AdventureWeather;
  } | null>(null);
  const [retryKey, setRetryKey] = useState(0);
  const fingerprint = weatherFingerprint(adventure);
  const requestKey = `${fingerprint}:${retryKey}`;
  const localState = localAdventureWeatherState(adventure);

  useEffect(() => {
    if (adventure.savedLocation.kind !== "confirmed") return;
    if (
      adventure.latitude === undefined ||
      adventure.longitude === undefined ||
      !adventure.timezone
    ) {
      return;
    }
    if (!adventure.startTime) {
      return;
    }
    const controller = new AbortController();
    void supabase.functions
      .invoke<AdventureWeather>("weather-for-adventure", {
        body: { adventureId: adventure.id },
        signal: controller.signal,
      })
      .then(async ({ data, error }) => {
        if (controller.signal.aborted) return;
        const errorWeather = error
          ? await weatherFromInvocationError(error)
          : null;
        if (controller.signal.aborted) return;
        const weather = isAdventureWeather(data) ? data : errorWeather;
        if (!weather) {
          if (import.meta.env.DEV)
            console.warn(
              "Adventure weather failed",
              error?.message ?? "Invalid response",
            );
          setResult({ key: requestKey, weather: { status: "unavailable" } });
          return;
        }
        setResult({ key: requestKey, weather });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        if (import.meta.env.DEV)
          console.warn("Adventure weather failed", error);
        setResult({ key: requestKey, weather: { status: "unavailable" } });
      });
    return () => controller.abort();
  }, [
    adventure.id,
    adventure.savedLocation.kind,
    adventure.latitude,
    adventure.longitude,
    adventure.timezone,
    adventure.startTime,
    requestKey,
  ]);

  return {
    weather: localState ?? (result?.key === requestKey ? result.weather : null),
    loading: !localState && result?.key !== requestKey,
    retry: useCallback(() => setRetryKey((value) => value + 1), []),
  };
}

function formatWeatherTime(sourceTime: string) {
  const match = /T(\d{2}):(\d{2})/.exec(sourceTime);
  if (!match) return "the scheduled time";
  const date = new Date(
    Date.UTC(2020, 0, 1, Number(match[1]), Number(match[2])),
  );
  return new Intl.DateTimeFormat("en-CA", {
    hour: "numeric",
    minute: match[2] === "00" ? undefined : "2-digit",
    timeZone: "UTC",
  }).format(date);
}

function relativeUpdatedAt(value: string) {
  const minutes = Math.max(
    0,
    Math.round((Date.now() - Date.parse(value)) / 60_000),
  );
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  return `${hours} ${hours === 1 ? "hour" : "hours"} ago`;
}

function formatAvailableFrom(value: string) {
  return new Intl.DateTimeFormat("en-CA", {
    month: "short",
    day: "numeric",
  }).format(new Date(`${value}T12:00:00`));
}

type WeatherIndicatorProps = {
  adventure: Adventure;
  canEdit: boolean;
  onEdit: () => void;
};

export function WeatherIndicator({
  adventure,
  canEdit,
  onEdit,
}: WeatherIndicatorProps) {
  const { weather, loading, retry } = useAdventureWeather(adventure);
  const [open, setOpen] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const buttonRef = useRef<HTMLButtonElement>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const detailed =
    weather?.status === "forecast" || weather?.status === "historical";

  const updatePosition = useCallback(() => {
    const button = buttonRef.current;
    if (!button) return;
    const rect = button.getBoundingClientRect();
    const width = Math.min(286, window.innerWidth - 24);
    setPosition({
      top: Math.max(12, Math.min(rect.bottom + 8, window.innerHeight - 250)),
      left: Math.max(
        12,
        Math.min(rect.right - width, window.innerWidth - width - 12),
      ),
    });
  }, []);

  useEffect(() => {
    if (!open) return;
    updatePosition();
    const onPointerDown = (event: PointerEvent) => {
      const target = event.target as Node;
      if (
        !buttonRef.current?.contains(target) &&
        !popoverRef.current?.contains(target)
      )
        setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [open, updatePosition]);

  if (loading)
    return (
      <span
        className="weather-loading"
        role="status"
        aria-label="Loading weather"
      />
    );
  if (!weather) return null;

  if (detailed) {
    const presentation = getWeatherPresentation(weather.weatherCode);
    const Icon = presentation.Icon;
    const historical = weather.status === "historical";
    return (
      <div className="weather-control">
        <button
          ref={buttonRef}
          className={`weather-trigger ${presentation.tone}`}
          type="button"
          aria-label={
            historical ? "View historical weather" : "View weather forecast"
          }
          aria-expanded={open}
          aria-haspopup="dialog"
          onClick={() => setOpen((value) => !value)}
        >
          <Icon aria-hidden="true" />
          <span>{Math.round(weather.temperatureC)}°C</span>
          {historical && <small>Past</small>}
        </button>
        {open &&
          createPortal(
            <div
              ref={popoverRef}
              className="weather-popover"
              role="dialog"
              aria-label={
                historical
                  ? "Historical weather details"
                  : "Weather forecast details"
              }
              style={{ top: position.top, left: position.left }}
            >
              <span className="weather-eyebrow">
                {historical ? "Historical weather" : "Weather forecast"}
              </span>
              <div className="weather-popover-title">
                <Icon aria-hidden="true" />
                <strong>{presentation.label}</strong>
              </div>
              <p>
                {Math.round(weather.temperatureC)}°C
                {weather.apparentTemperatureC !== null &&
                  ` · ${historical ? "Felt" : "Feels"} like ${Math.round(weather.apparentTemperatureC)}°C`}
              </p>
              {weather.status === "forecast" &&
                weather.precipitationProbability !== null && (
                  <p>
                    Rain chance {Math.round(weather.precipitationProbability)}%
                  </p>
                )}
              {weather.status === "historical" &&
                weather.precipitationMm !== null && (
                  <p>{weather.precipitationMm.toFixed(1)} mm precipitation</p>
                )}
              {weather.windSpeedKph !== null && (
                <p>Wind {Math.round(weather.windSpeedKph)} km/h</p>
              )}
              <p>For {formatWeatherTime(weather.sourceTime)}</p>
              {weather.status === "forecast" && (
                <small>Updated {relativeUpdatedAt(weather.updatedAt)}</small>
              )}
              {historical && (
                <small>Open-Meteo historical reanalysis conditions</small>
              )}
            </div>,
            document.body,
          )}
      </div>
    );
  }

  if (weather.status === "too-early")
    return (
      <span
        className="weather-state"
        title={`Available around ${formatAvailableFrom(weather.availableFrom)}`}
      >
        Weather closer to date
      </span>
    );
  if (weather.status === "missing-location")
    return canEdit ? (
      <button
        className="weather-state weather-action"
        type="button"
        onClick={onEdit}
      >
        Add location for weather
      </button>
    ) : (
      <span className="weather-state">Add location for weather</span>
    );
  if (weather.status === "location-unconfirmed")
    return canEdit ? (
      <button
        className="weather-state weather-action"
        type="button"
        onClick={onEdit}
      >
        Select location for weather
      </button>
    ) : (
      <span className="weather-state">Weather needs a confirmed location</span>
    );
  if (weather.status === "missing-coordinates")
    return canEdit ? (
      <button
        className="weather-state weather-action"
        type="button"
        onClick={onEdit}
      >
        Select location for weather
      </button>
    ) : (
      <span className="weather-state">Weather needs location setup</span>
    );
  if (weather.status === "missing-time")
    return canEdit ? (
      <button
        className="weather-state weather-action"
        type="button"
        onClick={onEdit}
      >
        Add time for weather
      </button>
    ) : (
      <span className="weather-state">Add time for weather</span>
    );
  if (weather.status === "provider-unavailable")
    return (
      <button
        className="weather-state weather-action"
        type="button"
        onClick={retry}
      >
        <RefreshCw aria-hidden="true" /> Weather temporarily unavailable
      </button>
    );
  if (
    weather.status === "invalid-timezone" ||
    weather.status === "no-hourly-match"
  )
    return (
      <button
        className="weather-state weather-action"
        type="button"
        onClick={retry}
      >
        <RefreshCw aria-hidden="true" /> Weather unavailable
      </button>
    );
  return (
    <button
      className="weather-state weather-action"
      type="button"
      onClick={retry}
    >
      <RefreshCw aria-hidden="true" /> Weather unavailable
    </button>
  );
}
