import type { AdventureStop } from "./types";

export type AdventureDayOption = {
  value: string;
  dayNumber: number;
  label: string;
  longLabel: string;
};

function parseDateKey(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    ? date
    : null;
}

function dateKey(date: Date) {
  return [
    date.getUTCFullYear(),
    String(date.getUTCMonth() + 1).padStart(2, "0"),
    String(date.getUTCDate()).padStart(2, "0"),
  ].join("-");
}

function addDays(value: string, amount: number) {
  const date = parseDateKey(value);
  if (!date) return null;
  date.setUTCDate(date.getUTCDate() + amount);
  return dateKey(date);
}

function dayOffset(startDate: string, value: string) {
  const start = parseDateKey(startDate);
  const date = parseDateKey(value);
  return start && date
    ? Math.round((date.getTime() - start.getTime()) / 86_400_000)
    : null;
}

export function buildAdventureDayOptions(
  startDate: string,
  endDate?: string,
): AdventureDayOption[] {
  const start = parseDateKey(startDate);
  const end = parseDateKey(endDate || startDate);
  if (!start || !end || end < start) return [];
  const count = Math.round((end.getTime() - start.getTime()) / 86_400_000) + 1;
  const shortFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const longFormatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric",
  });
  return Array.from({ length: count }, (_, index) => {
    const date = new Date(start.getTime() + index * 86_400_000);
    return {
      value: dateKey(date),
      dayNumber: index + 1,
      label: `Day ${index + 1} — ${shortFormatter.format(date)}`,
      longLabel: longFormatter.format(date),
    };
  });
}

function effectiveStopDay(stop: AdventureStop, adventureStartDate: string) {
  return stop.dayDate || adventureStartDate;
}

export function sortStopsByDayAndOrder(
  stops: AdventureStop[],
  adventureStartDate: string,
) {
  return [...stops].sort((first, second) =>
    effectiveStopDay(first, adventureStartDate).localeCompare(
      effectiveStopDay(second, adventureStartDate),
    ) || first.sortOrder - second.sortOrder
  );
}

export function groupStopsByDay(
  stops: AdventureStop[],
  startDate: string,
  endDate?: string,
) {
  const options = buildAdventureDayOptions(startDate, endDate);
  const byDate = new Map<string, AdventureStop[]>();
  for (const stop of sortStopsByDayAndOrder(stops, startDate)) {
    const day = effectiveStopDay(stop, startDate);
    const group = byDate.get(day) ?? [];
    group.push(stop);
    byDate.set(day, group);
  }
  return options
    .filter(({ value }) => byDate.has(value))
    .map((option) => ({ ...option, stops: byDate.get(option.value) ?? [] }));
}

export type StopDayReconciliation =
  | { ok: true; stops: AdventureStop[] }
  | { ok: false; affectedTitles: string[] };

export function reconcileStopDaysForAdventureRange(
  stops: AdventureStop[],
  previousStartDate: string,
  nextStartDate: string,
  nextEndDate?: string,
): StopDayReconciliation {
  const nextOptions = buildAdventureDayOptions(nextStartDate, nextEndDate);
  if (!nextOptions.length)
    return { ok: false, affectedTitles: stops.map(({ title }) => title) };
  const finalOffset = nextOptions.length - 1;
  const offsets = stops.map((stop) => ({
    stop,
    offset: dayOffset(
      previousStartDate,
      effectiveStopDay(stop, previousStartDate),
    ),
  }));
  const affectedTitles = offsets
    .filter(({ offset }) => offset === null || offset < 0 || offset > finalOffset)
    .map(({ stop }) => stop.title);
  if (affectedTitles.length) return { ok: false, affectedTitles };
  return {
    ok: true,
    stops: offsets.map(({ stop, offset }) => ({
      ...stop,
      dayDate: addDays(nextStartDate, offset ?? 0) ?? nextStartDate,
    })),
  };
}

export function timeToMinutes(value: string | null | undefined): number | null {
  const normalized = value?.trim();
  if (!normalized) return null;

  const twelveHour = normalized.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (twelveHour) {
    const hour = Number(twelveHour[1]);
    const minute = Number(twelveHour[2]);
    if (hour < 1 || hour > 12 || minute > 59) return null;
    return (hour % 12 + (twelveHour[3].toUpperCase() === "PM" ? 12 : 0)) * 60 + minute;
  }

  const twentyFourHour = normalized.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!twentyFourHour) return null;
  const hour = Number(twentyFourHour[1]);
  const minute = Number(twentyFourHour[2]);
  const second = twentyFourHour[3] ? Number(twentyFourHour[3]) : 0;
  if (hour > 23 || minute > 59 || second > 59) return null;
  return hour * 60 + minute;
}

export function insertStopChronologically(
  existingStops: AdventureStop[],
  newStop: AdventureStop,
  adventureStartDate: string,
): AdventureStop[] {
  const ordered = sortStopsByDayAndOrder(existingStops, adventureStartDate);
  const newTime = timeToMinutes(newStop.startTime);
  const newDay = effectiveStopDay(newStop, adventureStartDate);
  const dayStart = ordered.findIndex(
    (stop) => effectiveStopDay(stop, adventureStartDate) === newDay,
  );
  let insertionIndex = dayStart === -1
    ? ordered.findIndex(
        (stop) => effectiveStopDay(stop, adventureStartDate) > newDay,
      )
    : dayStart;
  if (insertionIndex === -1) insertionIndex = ordered.length;
  const dayEnd = dayStart === -1
    ? insertionIndex
    : ordered.findIndex(
        (stop, index) =>
          index >= dayStart &&
          effectiveStopDay(stop, adventureStartDate) !== newDay,
      );
  const end = dayEnd === -1 ? ordered.length : dayEnd;

  if (newTime !== null) {
    let firstUntimedIndex = -1;
    insertionIndex = end;
    for (let index = dayStart === -1 ? insertionIndex : dayStart; index < end; index += 1) {
      const existingTime = timeToMinutes(ordered[index].startTime);
      if (existingTime === null) {
        if (firstUntimedIndex === -1) firstUntimedIndex = index;
        continue;
      }
      if (existingTime > newTime) {
        insertionIndex = index;
        break;
      }
    }
    if (insertionIndex === end && firstUntimedIndex !== -1)
      insertionIndex = firstUntimedIndex;
  } else {
    insertionIndex = end;
  }

  ordered.splice(insertionIndex, 0, newStop);
  return ordered.map((stop, index) => ({ ...stop, sortOrder: index + 1 }));
}
