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
  ideas as seedIdeas,
} from "./data";
import type {
  Adventure,
  AdventurePlanInput,
  CalendarEvent,
  AdventureStop,
  Idea,
  IdeaStatus,
} from "./types";
type Store = {
  ideas: Idea[];
  adventures: Adventure[];
  calendarEvents: CalendarEvent[];
  calendarTargetDate: string | null;
  saveIdea: (idea: Idea) => void;
  setIdeaStatus: (id: string, status: IdeaStatus) => void;
  promoteIdeaToAdventure: (
    id: string,
    plan: AdventurePlanInput,
  ) => Adventure | null;
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
const displayTime = (value: string) => {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  const suffix = hours >= 12 ? "PM" : "AM";
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${suffix}`;
};
const normalizeStops = (stops: AdventureStop[]) =>
  [...stops]
    .sort((a, b) => a.sortOrder - b.sortOrder)
    .map((stop, index) => ({ ...stop, sortOrder: index + 1 }));
export function AdventureProvider({ children }: { children: ReactNode }) {
  const [ideas, setIdeas] = useState(seedIdeas);
  const [adventures, setAdventures] = useState(seedAdventures);
  const [calendarTargetDate, setCalendarTargetDate] = useState<string | null>(
    null,
  );
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
  const saveIdea = (idea: Idea) =>
    setIdeas((p) =>
      p.some((x) => x.id === idea.id)
        ? p.map((x) => (x.id === idea.id ? idea : x))
        : [idea, ...p],
    );
  const update = (id: string, fn: (a: Adventure) => Adventure) =>
    setAdventures((p) => p.map((a) => (a.id === id ? fn(a) : a)));
  const promoteIdeaToAdventure = (id: string, plan: AdventurePlanInput) => {
    const idea = ideas.find((x) => x.id === id);
    if (!idea || idea.linkedAdventureId)
      return idea?.linkedAdventureId
        ? adventures.find((a) => a.id === idea.linkedAdventureId) || null
        : null;
    const adventureId = `adv-${idea.id}-${Date.now().toString(36)}`;
    const adventure: Adventure = {
      id: adventureId,
      title: plan.title.trim(),
      description: plan.description.trim(),
      date: plan.date,
      startTime: displayTime(plan.startTime),
      endTime: displayTime(plan.endTime),
      status: plan.status,
      coverImage: idea.optionalImage,
      location: plan.location.trim() || "Location to be decided",
      category: idea.category,
      sourceIdeaId: idea.id,
      addedBy: idea.addedBy,
      updatedBy: idea.addedBy,
      completed: false,
      favorite: false,
      notes: plan.notes.trim(),
      links: idea.optionalLink
        ? [
            {
              id: `link-${idea.id}`,
              label: "Idea link",
              url: idea.optionalLink,
            },
          ]
        : [],
      checklist: [],
      stops: [],
    };
    setIdeas((p) =>
      p.map((x) =>
        x.id === id
          ? { ...x, status: "Confirmed", linkedAdventureId: adventureId }
          : x,
      ),
    );
    setAdventures((p) => [adventure, ...p]);
    setCalendarTargetDate(adventure.date);
    return adventure;
  };
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
        ideas,
        adventures,
        calendarEvents,
        calendarTargetDate,
        saveIdea,
        setIdeaStatus: (id, status) =>
          setIdeas((p) => p.map((i) => (i.id === id ? { ...i, status } : i))),
        promoteIdeaToAdventure,
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
