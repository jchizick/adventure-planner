import { useMemo, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import {
  Bell,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  ChevronDown,
  Clock,
  Heart,
  MapPin,
  MoreHorizontal,
  Plus,
  Search,
  SlidersHorizontal,
  Sparkles,
  Sun,
  Utensils,
  Music,
  Mountain,
  Palette,
  Home,
  Check,
  ExternalLink,
  Pencil,
  Trash2,
} from "lucide-react";
import { useAdventureStore } from "./context";
import { ideas as prototypeIdeas } from "./data";
import { useIdeas } from "./ideas";
import {
  addLocalDays,
  addMonths,
  buildMonthGrid,
  monthForDate,
  parseLocalDate,
  sortCalendarEvents,
  toLocalDateKey,
} from "./calendar";
import { PageHeader, QuickAdd, Sheet, StatusChip } from "./components";
import type { AdventureStop, Category, Idea, IdeaStatus } from "./types";
const catIcon: Record<string, typeof Heart> = {
  Dates: Heart,
  Food: Utensils,
  Concerts: Music,
  Outdoors: Mountain,
  "Camping & Travel": Mountain,
  Culture: Palette,
  Errands: Check,
  "At Home": Home,
};
const formatDate = (iso: string) =>
  new Intl.DateTimeFormat("en-CA", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(new Date(iso + "T12:00:00"));
export function Today() {
  const nav = useNavigate();
  const { adventures } = useAdventureStore();
  const upcoming = [...adventures]
    .filter((a) => !a.completed)
    .sort((a, b) => a.date.localeCompare(b.date));
  const next = upcoming[0];
  if (!next)
    return (
      <div className="page today">
        <PageHeader eyebrow="Our Adventures 💕" title="Jordan & Liz" />
        <p>No upcoming adventures yet.</p>
      </div>
    );
  return (
    <div className="page today">
      <PageHeader
        eyebrow="Our Adventures 💕"
        title="Jordan & Liz"
        action={
          <button className="icon-button">
            <Bell />
          </button>
        }
      />
      <button className="hero" onClick={() => nav(`/adventures/${next.id}`)}>
        <img src={next.coverImage || "/vaughan-day.png"} alt="" />
        <div className="hero-shade" />
        <div className="hero-copy">
          <span className="hero-label">NEXT ADVENTURE</span>
          <h2>{next.title}</h2>
          <p>
            {formatDate(next.date)} · {next.startTime}
          </p>
          <span className="countdown">Coming up</span>
        </div>
        <Heart className="hero-heart" />
      </button>
      <SectionTitle title="Up Next" action="See All" />
      <div className="list-card">
        {upcoming.slice(0, 4).map((a, i) => (
          <button
            className="upcoming-row"
            key={a.id}
            onClick={() => nav(`/adventures/${a.id}`)}
          >
            <span className={`row-icon c${i}`}>
              <Clock />
            </span>
            <span>
              <b>{a.title}</b>
              <small>
                {formatDate(a.date)} · {a.startTime}
              </small>
            </span>
            <em>{a.status}</em>
          </button>
        ))}
      </div>
      <SectionTitle title="New Ideas" action="See All" />
      <div className="idea-rail">
        {prototypeIdeas.slice(0, 3).map((i, n) => (
          <button key={i.id} onClick={() => nav("/ideas")}>
            <span>{i.title}</span>
            <small>{i.addedBy} added</small>
            <div className={`mini-art art${n}`}>
              {n === 0 ? "🧺" : n === 1 ? "🛶" : "🌿"}
            </div>
          </button>
        ))}
      </div>
      <QuickAdd onClick={() => nav("/ideas?add=1")} />
    </div>
  );
}
function SectionTitle({ title, action }: { title: string; action?: string }) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {action && <span>{action}</span>}
    </div>
  );
}
const blankIdea: Idea = {
  id: "",
  title: "",
  description: "",
  category: "Dates",
  status: "Idea",
  tags: [],
  addedBy: "Jordan",
  createdAt: "2026-07-12",
};
export function Ideas() {
  const nav = useNavigate();
  const { ideas, loading, error, retry, saveIdea, setIdeaStatus } = useIdeas();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<Category | "All">("All");
  const [editing, setEditing] = useState<Idea | null>(null);
  const counts = useMemo(
    () =>
      ideas.reduce<Record<string, number>>(
        (a, i) => ((a[i.category] = (a[i.category] || 0) + 1), a),
        {},
      ),
    [ideas],
  );
  const shown = ideas.filter(
    (i) =>
      (filter === "All" || i.category === filter) &&
      (i.title + i.description).toLowerCase().includes(query.toLowerCase()),
  );
  const categories: (Category | "All")[] = [
    "All",
    "Dates",
    "Food",
    "Outdoors",
    "Culture",
    "At Home",
  ];
  return (
    <div className="page ideas">
      <PageHeader
        title="Ideas"
        action={
          <button
            className="icon-button"
            onClick={() => setEditing({ ...blankIdea })}
            aria-label="Add idea"
          >
            <Plus />
          </button>
        }
      />
      <div className="search">
        <Search />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search shared ideas"
        />
        <SlidersHorizontal />
      </div>
      <div className="category-grid">
        {categories.map((c, n) => {
          const Icon = catIcon[c] || Sparkles;
          return (
            <button
              className={`category-tile t${n} ${filter === c ? "selected" : ""}`}
              key={c}
              onClick={() => setFilter(c)}
            >
              <Icon />
              <span>{c === "All" ? "All Ideas" : c}</span>
              <b>{c === "All" ? ideas.length : counts[c] || 0}</b>
            </button>
          );
        })}
      </div>
      <SectionTitle title="Saved Ideas" />
      {loading ? (
        <div className="ideas-state" role="status" aria-live="polite">
          <span className="access-spinner" aria-hidden="true" />
          <h3>Gathering your ideas…</h3>
          <p>Opening the plans saved in this shared space.</p>
        </div>
      ) : error ? (
        <div className="ideas-state ideas-error" role="alert">
          <h3>Ideas could not be loaded</h3>
          <p>{error}</p>
          <button className="secondary" onClick={() => void retry()}>
            Try again
          </button>
        </div>
      ) : ideas.length === 0 ? (
        <div className="ideas-state">
          <Sparkles aria-hidden="true" />
          <h3>Start your shared idea list</h3>
          <p>Save a date, meal, outing, or little plan you want to remember.</p>
          <button
            className="primary"
            onClick={() => setEditing({ ...blankIdea })}
          >
            Add your first idea
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="ideas-state">
          <Search aria-hidden="true" />
          <h3>No matching ideas</h3>
          <p>Try another search or category.</p>
        </div>
      ) : (
        <div className="idea-list">
          {shown.map((i) => (
            <article
              className="idea-card"
              data-idea-id={i.id}
              tabIndex={0}
              role="button"
              key={i.id}
              onClick={() => setEditing(i)}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  setEditing(i);
                }
              }}
            >
              <div className={`idea-thumb ${i.category.replaceAll(" ", "-")}`}>
                <span>
                  {(
                    {
                      Food: "🍝",
                      Culture: "🏛️",
                      Concerts: "🎸",
                      "Camping & Travel": "🏕️",
                      Errands: "🧺",
                    } as Record<string, string>
                  )[i.category] || "✨"}
                </span>
              </div>
              <div className="idea-body">
                <h3>{i.title}</h3>
                <p>{i.description}</p>
                <div>
                  {i.linkedAdventureId ? (
                    <span className="planned-chip">
                      <Check /> Planned
                    </span>
                  ) : (
                    <StatusChip status={i.status} />
                  )}
                  <small>{i.addedBy} added</small>
                </div>
              </div>
              <MoreHorizontal />
            </article>
          ))}
        </div>
      )}
      <QuickAdd onClick={() => setEditing({ ...blankIdea })} />
      <IdeaSheet
        idea={editing}
        onClose={() => setEditing(null)}
        onSave={saveIdea}
        onStatus={setIdeaStatus}
        onView={(id) => nav(`/adventures/${id}`)}
      />
    </div>
  );
}
function IdeaSheet({
  idea,
  onClose,
  onSave,
  onStatus,
  onView,
}: {
  idea: Idea | null;
  onClose: () => void;
  onSave: (i: Idea) => Promise<void>;
  onStatus: (id: string, s: IdeaStatus) => Promise<void>;
  onView: (id: string) => void;
}) {
  const [draft, setDraft] = useState<Idea | null>(idea);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  if (idea && !draft) setDraft(idea);
  if (!idea) return null;
  const d = draft?.id === idea.id ? draft : idea;
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(d);
      onClose();
    } catch (error) {
      setSaveError(
        error instanceof Error
          ? error.message
          : "We could not save this idea. Please try again.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet open title={idea.id ? "Edit idea" : "Add an idea"} onClose={onClose}>
      <form className="idea-form" onSubmit={submit}>
        <label>
          Title
          <input
            required
            value={d.title}
            onChange={(e) => setDraft({ ...d, title: e.target.value })}
          />
        </label>
        <label>
          Description
          <textarea
            value={d.description}
            onChange={(e) => setDraft({ ...d, description: e.target.value })}
          />
        </label>
        <div className="form-row">
          <label>
            Category
            <select
              value={d.category}
              onChange={(e) =>
                setDraft({ ...d, category: e.target.value as Category })
              }
            >
              {[
                "Dates",
                "Food",
                "Concerts",
                "Outdoors",
                "Camping & Travel",
                "Culture",
                "Errands",
                "At Home",
              ].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
          <label>
            Status
            <select
              value={d.status}
              onChange={(e) =>
                setDraft({ ...d, status: e.target.value as IdeaStatus })
              }
            >
              {["Idea", "Tentative", "Confirmed"].map((x) => (
                <option key={x}>{x}</option>
              ))}
            </select>
          </label>
        </div>
        {saveError && (
          <p className="form-error" role="alert">
            {saveError}
          </p>
        )}
        <button className="primary" type="submit" disabled={saving}>
          {saving ? "Saving…" : "Save idea"}
        </button>
        {idea.id && (
          <>
            <button
              type="button"
              className="secondary"
              disabled={saving}
              onClick={async () => {
                setSaving(true);
                setSaveError(null);
                try {
                  await onStatus(
                    idea.id,
                    d.status === "Confirmed" ? "Idea" : "Confirmed",
                  );
                  onClose();
                } catch (error) {
                  setSaveError(
                    error instanceof Error
                      ? error.message
                      : "We could not update this idea. Please try again.",
                  );
                } finally {
                  setSaving(false);
                }
              }}
            >
              Change status
            </button>
            {idea.linkedAdventureId ? (
              <button
                type="button"
                className="text-action"
                onClick={() => onView(idea.linkedAdventureId!)}
              >
                View adventure <ChevronRight />
              </button>
            ) : (
              <button
                type="button"
                className="text-action"
                disabled
                title="Adventure persistence is coming next."
              >
                Turn into an adventure <ChevronRight />
              </button>
            )}
            {!idea.linkedAdventureId && (
              <small className="coming-next">
                Adventure persistence is coming next.
              </small>
            )}
          </>
        )}
      </form>
    </Sheet>
  );
}
const monthLabelFormatter = new Intl.DateTimeFormat("en-CA", {
  month: "long",
  year: "numeric",
});
const fullDateFormatter = new Intl.DateTimeFormat("en-CA", {
  weekday: "long",
  month: "long",
  day: "numeric",
  year: "numeric",
});
const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export function Calendar() {
  const nav = useNavigate();
  const { calendarEvents, calendarTargetDate } = useAdventureStore();
  const todayKey = toLocalDateKey(new Date());
  const initialDate = calendarTargetDate || todayKey;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    monthForDate(initialDate),
  );

  const monthDays = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, typeof calendarEvents>();
    for (const event of calendarEvents) {
      const existing = grouped.get(event.date) || [];
      grouped.set(event.date, [...existing, event]);
    }
    return grouped;
  }, [calendarEvents]);
  const selectedEvents = sortCalendarEvents(
    eventsByDate.get(selectedDate) || [],
  );

  const selectDate = (dateKey: string, moveFocus = false) => {
    setSelectedDate(dateKey);
    setVisibleMonth(monthForDate(dateKey));
    if (moveFocus)
      requestAnimationFrame(() =>
        document
          .querySelector<HTMLElement>(`[data-calendar-date="${dateKey}"]`)
          ?.focus(),
      );
  };
  const moveMonth = (amount: number) => {
    const nextMonth = addMonths(visibleMonth, amount);
    setVisibleMonth(nextMonth);
    setSelectedDate(toLocalDateKey(nextMonth));
  };
  const goToToday = () => selectDate(todayKey, true);

  return (
    <div className="page calendar-page">
      <PageHeader
        title="Calendar"
        action={
          <button className="today-button" onClick={goToToday}>
            Today
          </button>
        }
      />
      <div className="month-nav">
        <button
          className="month-arrow"
          onClick={() => moveMonth(-1)}
          aria-label="Previous month"
        >
          <ChevronLeft />
        </button>
        <b aria-live="polite">{monthLabelFormatter.format(visibleMonth)}</b>
        <button
          className="month-arrow"
          onClick={() => moveMonth(1)}
          aria-label="Next month"
        >
          <ChevronRight />
        </button>
      </div>
      <div className="calendar-grid" role="grid" aria-label="Month calendar">
        {weekdayLabels.map((label) => (
          <span className="weekday-label" key={label} role="columnheader">
            {label}
          </span>
        ))}
        {monthDays.map((day) => {
          const eventCount = eventsByDate.get(day.key)?.length || 0;
          const isSelected = day.key === selectedDate;
          const isToday = day.key === todayKey;
          const dateLabel = fullDateFormatter.format(day.date);
          return (
            <button
              type="button"
              role="gridcell"
              key={day.key}
              data-calendar-date={day.key}
              className={`calendar-day ${day.inCurrentMonth ? "" : "outside-month"} ${isSelected ? "selected" : ""} ${isToday ? "today" : ""}`}
              aria-label={`${dateLabel}${eventCount ? `, ${eventCount} ${eventCount === 1 ? "event" : "events"}` : ", no events"}`}
              aria-current={isSelected ? "date" : undefined}
              onClick={() => selectDate(day.key)}
              onKeyDown={(event) => {
                const offsets: Record<string, number> = {
                  ArrowLeft: -1,
                  ArrowRight: 1,
                  ArrowUp: -7,
                  ArrowDown: 7,
                };
                if (event.key === "Home") {
                  event.preventDefault();
                  goToToday();
                } else if (offsets[event.key]) {
                  event.preventDefault();
                  selectDate(addLocalDays(day.key, offsets[event.key]), true);
                }
              }}
            >
              <span>{day.date.getDate()}</span>
              {eventCount > 0 && <i className="event-dot" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
      <div className="selected-date-heading">
        <div>
          <span>Selected day</span>
          <h2>{fullDateFormatter.format(parseLocalDate(selectedDate))}</h2>
        </div>
        <span className="event-count">
          {selectedEvents.length || "No"}{" "}
          {selectedEvents.length === 1 ? "plan" : "plans"}
        </span>
      </div>
      {selectedEvents.length ? (
        <div className="agenda-list">
          {selectedEvents.map((event) => (
            <button
              key={event.id}
              className={`agenda-row ${event.status.toLowerCase()} ${event.category.replaceAll(" ", "-").replace("&", "and")}`}
              onClick={() =>
                event.adventureId && nav(`/adventures/${event.adventureId}`)
              }
            >
              <span className="agenda-time">
                {event.allDay ? "All day" : event.startTime || "Time TBD"}
              </span>
              <span className="agenda-copy">
                <b>{event.title}</b>
                <small>
                  {event.subtitle}
                  {event.endTime ? ` · until ${event.endTime}` : ""}
                </small>
              </span>
              <ChevronRight />
            </button>
          ))}
        </div>
      ) : (
        <div className="empty-day">
          <Sun />
          <h3>No plans yet for this day.</h3>
          <p>Save an idea now and turn it into your next adventure.</p>
          <button onClick={() => nav("/ideas")}>Browse ideas</button>
        </div>
      )}
    </div>
  );
}

type StopFormValue = {
  title: string;
  location: string;
  startTime: string;
  endTime: string;
  notes: string;
  travelMinutes: string;
};

const timeToInput = (value?: string) => {
  if (!value) return "";
  const match = value.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/i);
  if (!match) return value;
  let hours = Number(match[1]) % 12;
  if (match[3].toUpperCase() === "PM") hours += 12;
  return `${String(hours).padStart(2, "0")}:${match[2]}`;
};

const timeFromInput = (value: string) => {
  if (!value) return "";
  const [hours, minutes] = value.split(":").map(Number);
  return `${hours % 12 || 12}:${String(minutes).padStart(2, "0")} ${hours >= 12 ? "PM" : "AM"}`;
};

function StopEditorSheet({
  stop,
  onClose,
  onSave,
}: {
  stop?: AdventureStop;
  onClose: () => void;
  onSave: (stop: Omit<AdventureStop, "id" | "sortOrder">) => void;
}) {
  const [value, setValue] = useState<StopFormValue>(() => ({
    title: stop?.title || "",
    location: stop?.location || "",
    startTime: timeToInput(stop?.startTime),
    endTime: timeToInput(stop?.endTime),
    notes: stop?.notes || "",
    travelMinutes: stop?.optionalTravelTime?.match(/\d+/)?.[0] || "",
  }));
  const [errors, setErrors] = useState<{
    title?: string;
    endTime?: string;
    travelMinutes?: string;
  }>({});
  const update = (key: keyof StopFormValue, next: string) => {
    setValue((current) => ({ ...current, [key]: next }));
    if (key in errors)
      setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const submit = (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!value.title.trim()) nextErrors.title = "Enter a stop title.";
    if (value.endTime && value.startTime && value.endTime < value.startTime)
      nextErrors.endTime = "End time must be later than the start time.";
    if (value.travelMinutes && Number(value.travelMinutes) < 0)
      nextErrors.travelMinutes = "Travel time cannot be negative.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;
    onSave({
      title: value.title.trim(),
      location: value.location.trim(),
      startTime: timeFromInput(value.startTime),
      endTime: timeFromInput(value.endTime) || undefined,
      notes: value.notes.trim() || undefined,
      optionalTravelTime: value.travelMinutes
        ? `${Number(value.travelMinutes)} min`
        : undefined,
    });
  };
  return (
    <Sheet
      open
      title={stop ? "Edit itinerary stop" : "Add itinerary stop"}
      onClose={onClose}
    >
      <form className="idea-form stop-form" onSubmit={submit} noValidate>
        <label>
          Stop title
          <input
            aria-label="Stop title"
            value={value.title}
            onChange={(event) => update("title", event.target.value)}
            aria-invalid={!!errors.title}
            aria-describedby={errors.title ? "stop-title-error" : undefined}
          />
          {errors.title && (
            <span className="field-error" id="stop-title-error">
              {errors.title}
            </span>
          )}
        </label>
        <label>
          Location
          <input
            aria-label="Stop location"
            value={value.location}
            onChange={(event) => update("location", event.target.value)}
          />
        </label>
        <div className="form-row">
          <label>
            Start time
            <input
              aria-label="Stop start time"
              type="time"
              value={value.startTime}
              onChange={(event) => update("startTime", event.target.value)}
            />
          </label>
          <label>
            End time
            <input
              aria-label="Stop end time"
              type="time"
              value={value.endTime}
              onChange={(event) => update("endTime", event.target.value)}
              aria-invalid={!!errors.endTime}
              aria-describedby={errors.endTime ? "stop-end-error" : undefined}
            />
            {errors.endTime && (
              <span className="field-error" id="stop-end-error">
                {errors.endTime}
              </span>
            )}
          </label>
        </div>
        <label>
          Notes
          <textarea
            aria-label="Stop notes"
            value={value.notes}
            onChange={(event) => update("notes", event.target.value)}
          />
        </label>
        <label>
          Travel time to next stop (minutes)
          <input
            aria-label="Travel time to next stop"
            type="number"
            min="0"
            inputMode="numeric"
            value={value.travelMinutes}
            onChange={(event) => update("travelMinutes", event.target.value)}
            aria-invalid={!!errors.travelMinutes}
            aria-describedby={
              errors.travelMinutes ? "stop-travel-error" : undefined
            }
          />
          {errors.travelMinutes && (
            <span className="field-error" id="stop-travel-error">
              {errors.travelMinutes}
            </span>
          )}
        </label>
        <div className="sheet-actions">
          <button className="secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit">
            {stop ? "Save changes" : "Add stop"}
          </button>
        </div>
      </form>
    </Sheet>
  );
}

export function AdventureDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const {
    adventures,
    toggleChecklist,
    addChecklist,
    toggleFavorite,
    completeAdventure,
    addAdventureStop,
    updateAdventureStop,
    deleteAdventureStop,
    reorderAdventureStops,
  } = useAdventureStore();
  const a = adventures.find((x) => x.id === id);
  const [tab, setTab] = useState("Itinerary");
  const [item, setItem] = useState("");
  const [stopEditor, setStopEditor] = useState<{
    mode: "add" | "edit";
    stop?: AdventureStop;
  } | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<AdventureStop | null>(
    null,
  );
  if (!a)
    return (
      <div className="page">
        <p>Adventure not found.</p>
      </div>
    );
  const orderedStops = [...a.stops].sort(
    (first, second) => first.sortOrder - second.sortOrder,
  );
  return (
    <div className="detail">
      <div className="detail-cover">
        <img src={a.coverImage || "/vaughan-day.png"} alt="" />
        <button className="back" onClick={() => nav(-1)} aria-label="Go back">
          <ChevronLeft />
        </button>
        <button className="more" aria-label="More options">
          <MoreHorizontal />
        </button>
      </div>
      <section className="detail-sheet">
        <button
          className={`favorite ${a.favorite ? "on" : ""}`}
          onClick={() => toggleFavorite(a.id)}
          aria-label="Toggle favorite"
        >
          <Heart fill={a.favorite ? "currentColor" : "none"} />
        </button>
        <h1>{a.title}</h1>
        <p className="detail-date">
          {formatDate(a.date)}
          <br />
          {a.startTime} – {a.endTime}
        </p>
        <div className="detail-meta">
          <MapPin /> {a.location}
          <span>
            <Sun /> 23°C
          </span>
        </div>
        <nav className="tabs">
          {["Itinerary", "Notes", "Links", "Checklist"].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              onClick={() => setTab(t)}
              key={t}
            >
              {t}
            </button>
          ))}
        </nav>
        {tab === "Itinerary" && (
          <>
            <div className="itinerary-toolbar">
              <div>
                <h2>Day itinerary</h2>
                <span>
                  {orderedStops.length}{" "}
                  {orderedStops.length === 1 ? "stop" : "stops"}
                </span>
              </div>
              <button onClick={() => setStopEditor({ mode: "add" })}>
                <Plus /> Add stop
              </button>
            </div>
            <div
              className={`map-card ${orderedStops.length ? "" : "empty-route"}`}
            >
              {orderedStops.length ? (
                <>
                  {orderedStops.length > 1 && <div className="route-line" />}
                  {orderedStops.map((stop, index) => (
                    <span
                      className="pin dynamic-pin"
                      key={stop.id}
                      style={{
                        left: `${10 + (index / Math.max(orderedStops.length - 1, 1)) * 78}%`,
                        top: `${index % 2 ? 58 : 26}%`,
                      }}
                      aria-label={`Stop ${index + 1}: ${stop.title}`}
                    >
                      {index + 1}
                    </span>
                  ))}
                  <b>{orderedStops.length}-stop route</b>
                </>
              ) : (
                <div className="route-empty-copy">
                  <MapPin />
                  <span>Your route will appear here.</span>
                </div>
              )}
            </div>
            {orderedStops.length ? (
              <div className="stops">
                {orderedStops.map((stop, index) => (
                  <article key={stop.id}>
                    <span className="stop-num">{index + 1}</span>
                    <div className="stop-main">
                      <h3>{stop.title}</h3>
                      <p>{stop.location || "Location to be decided"}</p>
                      {stop.notes && (
                        <small className="stop-notes">{stop.notes}</small>
                      )}
                    </div>
                    <div className="stop-time">
                      <b>
                        {stop.startTime || "Time TBD"}
                        {stop.endTime && ` – ${stop.endTime}`}
                      </b>
                      {stop.optionalTravelTime && (
                        <small>
                          <Clock /> {stop.optionalTravelTime}
                        </small>
                      )}
                    </div>
                    <div className="stop-actions">
                      <button
                        onClick={() => reorderAdventureStops(a.id, stop.id, -1)}
                        disabled={index === 0}
                        aria-label={`Move ${stop.title} up`}
                      >
                        <ChevronUp />
                      </button>
                      <button
                        onClick={() => reorderAdventureStops(a.id, stop.id, 1)}
                        disabled={index === orderedStops.length - 1}
                        aria-label={`Move ${stop.title} down`}
                      >
                        <ChevronDown />
                      </button>
                      <button
                        onClick={() => setStopEditor({ mode: "edit", stop })}
                        aria-label={`Edit ${stop.title}`}
                      >
                        <Pencil />
                      </button>
                      <button
                        className="delete-stop"
                        onClick={() => setDeleteCandidate(stop)}
                        aria-label={`Delete ${stop.title}`}
                      >
                        <Trash2 />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="empty-itinerary">
                <MapPin />
                <h3>No itinerary stops yet.</h3>
                <p>Build the day one stop at a time.</p>
                <button onClick={() => setStopEditor({ mode: "add" })}>
                  Add first stop
                </button>
              </div>
            )}
          </>
        )}
        {tab === "Notes" && (
          <div className="tab-panel">
            <h2>Notes for the day</h2>
            <p>{a.notes || "No notes yet."}</p>
            <textarea aria-label="Adventure notes" defaultValue={a.notes} />
            <button className="primary">Save notes</button>
          </div>
        )}
        {tab === "Links" && (
          <div className="tab-panel">
            <h2>Useful links</h2>
            {a.links.map((l) => (
              <a className="link-row" href={l.url} target="_blank" key={l.id}>
                {l.label}
                <ExternalLink />
              </a>
            ))}
          </div>
        )}
        {tab === "Checklist" && (
          <div className="tab-panel checklist">
            <h2>Shared checklist</h2>
            {a.checklist.map((c) => (
              <label key={c.id}>
                <input
                  type="checkbox"
                  checked={c.completed}
                  onChange={() => toggleChecklist(a.id, c.id)}
                />
                <span>{c.label}</span>
              </label>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                if (item.trim()) {
                  addChecklist(a.id, item.trim());
                  setItem("");
                }
              }}
            >
              <input
                value={item}
                onChange={(e) => setItem(e.target.value)}
                placeholder="Add an item"
              />
              <button>
                <Plus />
              </button>
            </form>
          </div>
        )}
        {stopEditor && (
          <StopEditorSheet
            key={stopEditor.stop?.id || "new-stop"}
            stop={stopEditor.stop}
            onClose={() => setStopEditor(null)}
            onSave={(stop) => {
              if (stopEditor.mode === "edit" && stopEditor.stop)
                updateAdventureStop(a.id, stopEditor.stop.id, stop);
              else addAdventureStop(a.id, stop);
              setStopEditor(null);
            }}
          />
        )}
        {deleteCandidate && (
          <Sheet
            open
            title="Delete this stop?"
            onClose={() => setDeleteCandidate(null)}
          >
            <div className="delete-confirmation">
              <p>
                “{deleteCandidate.title}” will be removed from this itinerary.
              </p>
              <div className="sheet-actions">
                <button
                  className="secondary"
                  onClick={() => setDeleteCandidate(null)}
                >
                  Cancel
                </button>
                <button
                  className="danger-button"
                  onClick={() => {
                    deleteAdventureStop(a.id, deleteCandidate.id);
                    setDeleteCandidate(null);
                  }}
                >
                  Delete stop
                </button>
              </div>
            </div>
          </Sheet>
        )}
        <button
          className={`complete-button ${a.completed ? "done" : ""}`}
          onClick={() => completeAdventure(a.id)}
        >
          {a.completed ? (
            <>
              <Check /> Adventure completed
            </>
          ) : (
            <>
              Mark as completed <Sparkles />
            </>
          )}
        </button>
      </section>
    </div>
  );
}
export function Memories() {
  const { adventures } = useAdventureStore();
  const done = adventures.filter((a) => a.completed);
  return (
    <div className="page memories">
      <PageHeader eyebrow="The days worth keeping" title="Memories" />
      <div className="memory-intro">
        <Sparkles />
        <h2>Our story, one adventure at a time.</h2>
        <p>
          Completed plans become memories here—with room for photos, notes, and
          all the little things we want to remember.
        </p>
      </div>
      <SectionTitle title="Completed adventures" />
      <div className="memory-grid">
        {done.length ? (
          done.map((a) => (
            <article className="memory-card" key={a.id}>
              <div className="memory-art">🌅</div>
              <small>{formatDate(a.date)}</small>
              <h3>{a.title}</h3>
              <p>{a.description}</p>
            </article>
          ))
        ) : (
          <div className="empty-memory">
            <Heart />
            <h3>Your first memory is waiting</h3>
            <p>Complete an adventure and it will appear here.</p>
          </div>
        )}
      </div>
    </div>
  );
}
