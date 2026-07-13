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
  deleteAdventure as deleteAdventureRow,
  duplicateAdventure as duplicateAdventureRow,
  loadAdventures,
  promoteIdea as promoteIdeaRow,
  updateAdventure as updateAdventureRow,
  updateAdventureCover as updateAdventureCoverRow,
  updateAdventureFavorite,
  updateAdventureCompletion,
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
import { insertStopChronologically, timeToMinutes } from "./itinerary";
import {
  createChecklistItem,
  deleteChecklistItem,
  loadChecklist,
  reorderChecklist,
  updateChecklistItem,
} from "./repositories/checklist-items";
import {
  createLink,
  deleteLink,
  loadLinks,
  updateLink,
} from "./repositories/adventure-links";
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
  childDataLoading: boolean;
  childDataError: string | null;
  retry: () => Promise<void>;
  createAdventure: (plan: AdventurePlanInput) => Promise<Adventure>;
  promoteIdeaToAdventure: (
    ideaId: string,
    plan: AdventurePlanInput,
  ) => Promise<Adventure>;
  updateAdventure: (id: string, plan: AdventurePlanInput) => Promise<void>;
  updateAdventureCover: (id: string, coverImage: string) => Promise<void>;
  duplicateAdventure: (id: string) => Promise<Adventure>;
  deleteAdventure: (id: string) => Promise<void>;
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
  loadAdventureChildren: (adventureId: string) => Promise<void>;
  addChecklistItem: (adventureId: string, label: string) => Promise<void>;
  editChecklistItem: (adventureId: string, itemId: string, label: string) => Promise<void>;
  toggleChecklistItem: (adventureId: string, itemId: string) => Promise<void>;
  deleteChecklistItem: (adventureId: string, itemId: string) => Promise<void>;
  reorderChecklistItem: (adventureId: string, itemId: string, direction: -1 | 1) => Promise<void>;
  addAdventureLink: (adventureId: string, label: string, url: string) => Promise<void>;
  editAdventureLink: (adventureId: string, linkId: string, label: string, url: string) => Promise<void>;
  deleteAdventureLink: (adventureId: string, linkId: string) => Promise<void>;
  setAdventureCompleted: (id: string, completed: boolean) => Promise<void>;
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
  const [childDataLoading, setChildDataLoading] = useState(false);
  const [childDataError, setChildDataError] = useState<string | null>(null);
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
          ? {
              ...next,
              stops: adventure.stops,
              checklist: adventure.checklist,
              links: adventure.links,
            }
          : adventure,
      ),
    );
  }, []);

  const loadAdventureChildren = useCallback(async (adventureId: string) => {
    setChildDataLoading(true);
    setChildDataError(null);
    try {
      const [checklist, links] = await Promise.all([
        loadChecklist(adventureId),
        loadLinks(adventureId),
      ]);
      setAdventures((current) =>
        current.map((adventure) =>
          adventure.id === adventureId ? { ...adventure, checklist, links } : adventure,
        ),
      );
    } catch (nextError) {
      setChildDataError(nextError instanceof Error ? nextError.message : "We could not load the checklist and links.");
    } finally {
      setChildDataLoading(false);
    }
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
        category: adventure.category || "culture",
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
      childDataLoading,
      childDataError,
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
      updateAdventure: async (id, plan) => {
        if (!user || !activeSpace)
          throw new Error("Open your shared space and try again.");
        const current = adventures.find((adventure) => adventure.id === id);
        if (!current) throw new Error("Adventure not found.");
        replaceAdventure(
          await updateAdventureRow(
            activeSpace.id,
            id,
            user.id,
            plan,
            current.completed,
          ),
        );
      },
      updateAdventureCover: async (id, coverImage) => {
        if (!user || !activeSpace)
          throw new Error("Open your shared space and try again.");
        replaceAdventure(
          await updateAdventureCoverRow(activeSpace.id, id, user.id, coverImage),
        );
      },
      duplicateAdventure: async (id) => {
        if (!activeSpace)
          throw new Error("Open your shared space and try again.");
        const duplicate = await duplicateAdventureRow(activeSpace.id, id);
        setAdventures((current) => [...current, duplicate]);
        return duplicate;
      },
      deleteAdventure: async (id) => {
        if (!activeSpace)
          throw new Error("Open your shared space and try again.");
        await deleteAdventureRow(activeSpace.id, id);
        setAdventures((current) =>
          current.filter((adventure) => adventure.id !== id),
        );
      },
      loadAdventureStops,
      addAdventureStop: async (adventureId, stop) => {
        const adventure = adventures.find((item) => item.id === adventureId);
        if (!adventure) throw new Error("Adventure not found.");
        const nextSortOrder =
          Math.max(0, ...adventure.stops.map((item) => item.sortOrder)) + 1;
        const created = await createStop(
          adventureId,
          nextSortOrder,
          stop,
        );
        const next = insertStopChronologically(adventure.stops, created);
        try {
          await reorderStops(
            adventureId,
            next.map((item) => item.id),
          );
        } catch (error) {
          await deleteStop(adventureId, created.id).catch(() => undefined);
          throw error;
        }
        setAdventures((current) =>
          current.map((item) =>
            item.id === adventureId
              ? { ...item, stops: next }
              : item,
          ),
        );
      },
      updateAdventureStop: async (adventureId, stopId, stop) => {
        const adventure = adventures.find((item) => item.id === adventureId);
        if (!adventure) throw new Error("Adventure not found.");
        const existingStop = adventure.stops.find((item) => item.id === stopId);
        if (!existingStop) throw new Error("Stop not found.");
        const saved = await updateStop(adventureId, stopId, stop);
        const startTimeChanged =
          timeToMinutes(existingStop.startTime) !== timeToMinutes(saved.startTime);
        const next = startTimeChanged
          ? insertStopChronologically(
              adventure.stops.filter((item) => item.id !== stopId),
              saved,
            )
          : adventure.stops.map((item) => (item.id === stopId ? saved : item));
        if (startTimeChanged)
          await reorderStops(
            adventureId,
            next.map((item) => item.id),
          );
        setAdventures((current) =>
          current.map((item) =>
            item.id === adventureId
              ? { ...item, stops: next }
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
      loadAdventureChildren,
      addChecklistItem: async (adventureId, label) => {
        if (!user) throw new Error("Sign in and try again.");
        const adventure = adventures.find((item) => item.id === adventureId);
        if (!adventure) throw new Error("Adventure not found.");
        const created = await createChecklistItem(adventureId, user.id, label, adventure.checklist.length + 1);
        setAdventures((current) => current.map((item) => item.id === adventureId ? { ...item, checklist: [...item.checklist, created] } : item));
      },
      editChecklistItem: async (adventureId, itemId, label) => {
        const saved = await updateChecklistItem(adventureId, itemId, { label });
        setAdventures((current) => current.map((item) => item.id === adventureId ? { ...item, checklist: item.checklist.map((entry) => entry.id === itemId ? saved : entry) } : item));
      },
      toggleChecklistItem: async (adventureId, itemId) => {
        const adventure = adventures.find((item) => item.id === adventureId);
        const entry = adventure?.checklist.find((item) => item.id === itemId);
        if (!entry) throw new Error("Checklist item not found.");
        const saved = await updateChecklistItem(adventureId, itemId, { completed: !entry.completed });
        setAdventures((current) => current.map((item) => item.id === adventureId ? { ...item, checklist: item.checklist.map((candidate) => candidate.id === itemId ? saved : candidate) } : item));
      },
      deleteChecklistItem: async (adventureId, itemId) => {
        const adventure = adventures.find((item) => item.id === adventureId);
        if (!adventure) throw new Error("Adventure not found.");
        await deleteChecklistItem(adventureId, itemId);
        const remaining = adventure.checklist.filter((item) => item.id !== itemId);
        await reorderChecklist(adventureId, remaining.map((item) => item.id));
        setAdventures((current) => current.map((item) => item.id === adventureId ? { ...item, checklist: remaining.map((entry, index) => ({ ...entry, sortOrder: index + 1 })) } : item));
      },
      reorderChecklistItem: async (adventureId, itemId, direction) => {
        const adventure = adventures.find((item) => item.id === adventureId);
        if (!adventure) throw new Error("Adventure not found.");
        const next = [...adventure.checklist].sort((a, b) => a.sortOrder - b.sortOrder);
        const from = next.findIndex((item) => item.id === itemId);
        const to = from + direction;
        if (from < 0 || to < 0 || to >= next.length) return;
        [next[from], next[to]] = [next[to], next[from]];
        await reorderChecklist(adventureId, next.map((item) => item.id));
        setAdventures((current) => current.map((item) => item.id === adventureId ? { ...item, checklist: next.map((entry, index) => ({ ...entry, sortOrder: index + 1 })) } : item));
      },
      addAdventureLink: async (adventureId, label, url) => {
        const adventure = adventures.find((item) => item.id === adventureId);
        if (!adventure) throw new Error("Adventure not found.");
        const created = await createLink(adventureId, label, url, adventure.links.length + 1);
        setAdventures((current) => current.map((item) => item.id === adventureId ? { ...item, links: [...item.links, created] } : item));
      },
      editAdventureLink: async (adventureId, linkId, label, url) => {
        const saved = await updateLink(adventureId, linkId, label, url);
        setAdventures((current) => current.map((item) => item.id === adventureId ? { ...item, links: item.links.map((entry) => entry.id === linkId ? saved : entry) } : item));
      },
      deleteAdventureLink: async (adventureId, linkId) => {
        await deleteLink(adventureId, linkId);
        setAdventures((current) => current.map((item) => item.id === adventureId ? { ...item, links: item.links.filter((entry) => entry.id !== linkId) } : item));
      },
      setAdventureCompleted: async (id, completed) => {
        if (!user || !activeSpace) throw new Error("Open your shared space and try again.");
        replaceAdventure(await updateAdventureCompletion(activeSpace.id, id, user.id, completed));
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
      loadAdventureChildren,
      loading,
      replaceAdventure,
      stopsError,
      stopsLoading,
      childDataLoading,
      childDataError,
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
