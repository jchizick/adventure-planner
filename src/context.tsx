import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./auth";
import {
  createAdventure as createAdventureRow,
  loadAdventures,
  promoteIdea as promoteIdeaRow,
  updateAdventureFavorite,
  updateAdventureNotes,
} from "./repositories/adventures";
import {
  createStop,
  deleteStop,
  loadStops,
  reorderStops,
  updateStop,
  type StopDraft,
} from "./repositories/adventure-stops";
import type {
  Adventure,
  AdventurePlanInput,
  AdventureStop,
  CalendarEvent,
} from "./types";
import { useWorkspace } from "./workspace";

type Store = {
  adventures: Adventure[];
  calendarEvents: CalendarEvent[];
  calendarTargetDate: string | null;
  loading: boolean;
  error: string | null;
  stopsLoading: boolean;
  stopsError: string | null;
  retry: () => Promise<void>;
  createAdventure: (plan: AdventurePlanInput) => Promise<Adventure>;
  promoteIdeaToAdventure: (
    ideaId: string,
    plan: AdventurePlanInput,
  ) => Promise<Adventure>;
  loadAdventureStops: (adventureId: string) => Promise<void>;
  addAdventureStop: (adventureId: string, stop: StopDraft) => Promise<void>;
  updateAdventureStop: (
    adventureId: string,
    stopId: string,
    stop: StopDraft,
  ) => Promise<void>;
  deleteAdventureStop: (adventureId: string, stopId: string) => Promise<void>;
  reorderAdventureStops: (
    adventureId: string,
    stopId: string,
    direction: -1 | 1,
  ) => Promise<void>;
  toggleFavorite: (id: string) => Promise<void>;
  saveNotes: (id: string, notes: string) => Promise<void>;
};

const AdventureContext = createContext<Store | null>(null);

export function AdventureProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeSpace } = useWorkspace();
  const [adventures, setAdventures] = useState<Adventure[]>([]);
  const [calendarTargetDate, setCalendarTargetDate] = useState<string | null>(
    null,
  );
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stopsLoading, setStopsLoading] = useState(false);
  const [stopsError, setStopsError] = useState<string | null>(null);
  const creatingRef = useRef(false);

  const load = useCallback(async () => {
    if (!activeSpace) return;
    setLoading(true);
    setError(null);
    try {
      setAdventures(await loadAdventures(activeSpace.id));
    } catch (nextError) {
      setAdventures([]);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "We could not load your Adventures. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeSpace]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const replaceAdventure = useCallback((next: Adventure) => {
    setAdventures((current) =>
      current.map((adventure) =>
        adventure.id === next.id
          ? { ...next, stops: adventure.stops }
          : adventure,
      ),
    );
  }, []);

  const loadAdventureStops = useCallback(async (adventureId: string) => {
    setStopsLoading(true);
    setStopsError(null);
    try {
      const stops = await loadStops(adventureId);
      setAdventures((current) =>
        current.map((adventure) =>
          adventure.id === adventureId ? { ...adventure, stops } : adventure,
        ),
      );
    } catch (nextError) {
      setStopsError(
        nextError instanceof Error
          ? nextError.message
          : "We could not load this itinerary.",
      );
    } finally {
      setStopsLoading(false);
    }
  }, []);

  const calendarEvents = useMemo<CalendarEvent[]>(
    () =>
      adventures.map((adventure) => ({
        id: `adventure-${adventure.id}`,
        title: adventure.title,
        subtitle: adventure.location || "Adventure",
        date: adventure.date,
        startTime: adventure.startTime,
        endTime: adventure.endTime || undefined,
        category: adventure.category || "Dates",
        status: adventure.status,
        adventureId: adventure.id,
      })),
    [adventures],
  );

  const value = useMemo<Store>(
    () => ({
      adventures,
      calendarEvents,
      calendarTargetDate,
      loading,
      error,
      stopsLoading,
      stopsError,
      retry: load,
      createAdventure: async (plan) => {
        if (!user || !activeSpace)
          throw new Error("Open your shared space and try again.");
        if (creatingRef.current)
          throw new Error("This Adventure is already being created.");
        creatingRef.current = true;
        try {
          const created = await createAdventureRow(
            activeSpace.id,
            user.id,
            plan,
          );
          setAdventures((current) => [...current, created]);
          setCalendarTargetDate(created.date);
          return created;
        } finally {
          creatingRef.current = false;
        }
      },
      promoteIdeaToAdventure: async (ideaId, plan) => {
        if (!activeSpace)
          throw new Error("Open your shared space and try again.");
        if (creatingRef.current)
          throw new Error("This Adventure is already being created.");
        creatingRef.current = true;
        try {
          const created = await promoteIdeaRow(activeSpace.id, ideaId, plan);
          setAdventures((current) => [...current, created]);
          setCalendarTargetDate(created.date);
          return created;
        } finally {
          creatingRef.current = false;
        }
      },
      loadAdventureStops,
      addAdventureStop: async (adventureId, stop) => {
        const adventure = adventures.find((item) => item.id === adventureId);
        if (!adventure) throw new Error("Adventure not found.");
        const created = await createStop(
          adventureId,
          adventure.stops.length + 1,
          stop,
        );
        setAdventures((current) =>
          current.map((item) =>
            item.id === adventureId
              ? { ...item, stops: [...item.stops, created] }
              : item,
          ),
        );
      },
      updateAdventureStop: async (adventureId, stopId, stop) => {
        const saved = await updateStop(adventureId, stopId, stop);
        setAdventures((current) =>
          current.map((item) =>
            item.id === adventureId
              ? {
                  ...item,
                  stops: item.stops.map((currentStop) =>
                    currentStop.id === stopId ? saved : currentStop,
                  ),
                }
              : item,
          ),
        );
      },
      deleteAdventureStop: async (adventureId, stopId) => {
        const adventure = adventures.find((item) => item.id === adventureId);
        if (!adventure) throw new Error("Adventure not found.");
        await deleteStop(adventureId, stopId);
        const remaining = adventure.stops.filter((stop) => stop.id !== stopId);
        await reorderStops(
          adventureId,
          remaining.map((stop) => stop.id),
        );
        setAdventures((current) =>
          current.map((item) =>
            item.id === adventureId
              ? {
                  ...item,
                  stops: remaining.map((stop, index) => ({
                    ...stop,
                    sortOrder: index + 1,
                  })),
                }
              : item,
          ),
        );
      },
      reorderAdventureStops: async (adventureId, stopId, direction) => {
        const adventure = adventures.find((item) => item.id === adventureId);
        if (!adventure) throw new Error("Adventure not found.");
        const next: AdventureStop[] = [...adventure.stops].sort(
          (a, b) => a.sortOrder - b.sortOrder,
        );
        const from = next.findIndex((stop) => stop.id === stopId);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= next.length) return;
        [next[from], next[to]] = [next[to], next[from]];
        await reorderStops(
          adventureId,
          next.map((stop) => stop.id),
        );
        setAdventures((current) =>
          current.map((item) =>
            item.id === adventureId
              ? {
                  ...item,
                  stops: next.map((stop, index) => ({
                    ...stop,
                    sortOrder: index + 1,
                  })),
                }
              : item,
          ),
        );
      },
      toggleFavorite: async (id) => {
        if (!user || !activeSpace)
          throw new Error("Open your shared space and try again.");
        const adventure = adventures.find((item) => item.id === id);
        if (!adventure) throw new Error("Adventure not found.");
        replaceAdventure(
          await updateAdventureFavorite(
            activeSpace.id,
            id,
            user.id,
            !adventure.favorite,
          ),
        );
      },
      saveNotes: async (id, notes) => {
        if (!user || !activeSpace)
          throw new Error("Open your shared space and try again.");
        replaceAdventure(
          await updateAdventureNotes(activeSpace.id, id, user.id, notes),
        );
      },
    }),
    [
      activeSpace,
      adventures,
      calendarEvents,
      calendarTargetDate,
      error,
      load,
      loadAdventureStops,
      loading,
      replaceAdventure,
      stopsError,
      stopsLoading,
      user,
    ],
  );

  return (
    <AdventureContext.Provider value={value}>
      {children}
    </AdventureContext.Provider>
  );
}

export function useAdventureStore() {
  const context = useContext(AdventureContext);
  if (!context)
    throw new Error("useAdventureStore must be used within AdventureProvider");
  return context;
}
