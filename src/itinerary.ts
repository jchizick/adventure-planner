import type { AdventureStop } from "./types";

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
): AdventureStop[] {
  const ordered = [...existingStops].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );
  const newTime = timeToMinutes(newStop.startTime);
  let insertionIndex = ordered.length;

  if (newTime !== null) {
    let firstUntimedIndex = -1;
    for (let index = 0; index < ordered.length; index += 1) {
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
    if (insertionIndex === ordered.length && firstUntimedIndex !== -1)
      insertionIndex = firstUntimedIndex;
  }

  ordered.splice(insertionIndex, 0, newStop);
  return ordered.map((stop, index) => ({ ...stop, sortOrder: index + 1 }));
}
