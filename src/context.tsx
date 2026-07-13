import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  adventures as seedAdventures,
  calendarEvents as seedCalendarEvents,
} from "./data";
import type { Adventure, CalendarEvent, AdventureStop } from "./types";
type Store = {
  adventures: Adventure[];
  calendarEvents: CalendarEvent[];
  calendarTargetDate: string | null;
  addAdventureStop: (
    adventureId: string,
    stop: Omit<AdventureStop, "id" | "sortOrder">,
  ) => AdventureStop;
  updateAdventureStop: (
    adventureId: string,
    stopId: string,
    stop: Omit<AdventureStop, "id" | "sortOrder">,
  ) => void;
  deleteAdventureStop: (adventureId: string, stopId: string) => void;
  reorderAdventureStops: (
    adventureId: string,
    stopId: string,
    direction: -1 | 1,
  ) => void;
  toggleChecklist: (adventureId: string, itemId: string) => void;
  addChecklist: (adventureId: string, label: string) => void;
  toggleFavorite: (id: string) => void;
  completeAdventure: (id: string) => void;
};
const C = createContext<Store | null>(null);
const normalizeStops = (stops: AdventureStop[]) =>
  [...stops]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((stop, index) => ({ ...stop, sortOrder: index + 1 }));
export function AdventureProvider({ children }: { children: ReactNode }) {
  const [adventures, setAdventures] = useState(seedAdventures);
  const calendarTargetDate = null;
  const calendarEvents = useMemo(
    () => [
      ...seedCalendarEvents,
      ...adventures
        .filter((a) => a.sourceIdeaId)
        .map<CalendarEvent>((a) => ({
          id: `event-${a.id}`,
          title: a.title,
          subtitle: a.location || "Adventure",
          date: a.date,
          startTime: a.startTime,
          endTime: a.endTime,
          category: a.category || "Dates",
          status: a.status,
          adventureId: a.id,
        })),
    ],
    [adventures],
  );
  const update = (id: string, fn: (a: Adventure) => Adventure) =>
    setAdventures((p) => p.map((a) => (a.id === id ? fn(a) : a)));
  const addAdventureStop = (
    adventureId: string,
    stop: Omit<AdventureStop, "id" | "sortOrder">,
  ) => {
    const created = { ...stop, id: crypto.randomUUID(), sortOrder: 1 };
    update(adventureId, (adventure) => ({
      ...adventure,
      stops: normalizeStops([
        ...adventure.stops,
        { ...created, sortOrder: adventure.stops.length + 1 },
      ]),
    }));
    return created;
  };
  const updateAdventureStop = (
    adventureId: string,
    stopId: string,
    stop: Omit<AdventureStop, "id" | "sortOrder">,
  ) =>
    update(adventureId, (adventure) => ({
      ...adventure,
      stops: normalizeStops(
        adventure.stops.map((current) =>
          current.id === stopId ? { ...current, ...stop } : current,
        ),
      ),
    }));
  const deleteAdventureStop = (adventureId: string, stopId: string) =>
    update(adventureId, (adventure) => ({
      ...adventure,
      stops: normalizeStops(
        adventure.stops.filter((stop) => stop.id !== stopId),
      ),
    }));
  const reorderAdventureStops = (
    adventureId: string,
    stopId: string,
    direction: -1 | 1,
  ) =>
    update(adventureId, (adventure) => {
      const stops = normalizeStops(adventure.stops);
      const from = stops.findIndex((stop) => stop.id === stopId);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= stops.length) return adventure;
      [stops[from], stops[to]] = [stops[to], stops[from]];
      return {
        ...adventure,
        stops: stops.map((stop, index) => ({ ...stop, sortOrder: index + 1 })),
      };
    });
  return (
    <C.Provider
      value={{
        adventures,
        calendarEvents,
        calendarTargetDate,
        addAdventureStop,
        updateAdventureStop,
        deleteAdventureStop,
        reorderAdventureStops,
        toggleChecklist: (id, itemId) =>
          update(id, (a) => ({
            ...a,
            checklist: a.checklist.map((c) =>
              c.id === itemId ? { ...c, completed: !c.completed } : c,
            ),
          })),
        addChecklist: (id, label) =>
          update(id, (a) => ({
            ...a,
            checklist: [
              ...a.checklist,
              { id: crypto.randomUUID(), label, completed: false },
            ],
          })),
        toggleFavorite: (id) =>
          update(id, (a) => ({ ...a, favorite: !a.favorite })),
        completeAdventure: (id) =>
          update(id, (a) => ({ ...a, completed: true })),
      }}
    >
      {children}
    </C.Provider>
  );
}
export const useAdventureStore = () => {
  const c = useContext(C);
  if (!c) throw new Error("Store missing");
  return c;
};
