import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useId,
  type CSSProperties,
  type FormEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import {
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
  Copy,
  ImagePlus,
  Pencil,
  Trash2,
  ExternalLink,
  Flag,
  Plane,
  Users,
  ShoppingBag,
} from "lucide-react";
import { useAdventureStore } from "./context";
import { useIdeas } from "./ideas";
import { selectRecentIdeas } from "./recent-ideas";
import {
  countAdvancedIdeaFilters,
  emptyAdvancedIdeaFilters,
  filterIdeas,
  isActiveIdea,
  selectCalendarProposalIdeas,
  duplicateIdeaForEditing,
  normalizeCategoryOrNull,
  primaryCategories,
  type AdvancedIdeaFilters,
  type IdeaCategoryFilter,
  type IdeaFilterStatus,
  type SchedulingFilter,
} from "./idea-model";
import { promoteAndReconcileIdea } from "./promotion-state";
import { normalizeIdeaUrl, safeIdeaUrl } from "./idea-url";
import { loadSpaceMembers, type SpaceMember } from "./repositories/invitations";
import { loadMemorySummaries } from "./repositories/memories";
import {
  CATEGORY_COVER_ASSETS,
  GENERIC_ADVENTURE_COVER,
  getCategoryCoverByVariant,
  getStableCategoryCover,
  resolveAdventureCover,
  resolveMemoryCover,
} from "./category-visuals";
import { IdeaCoverThumbnail } from "./idea-cover-thumbnail";
import { IdeaCoverPicker } from "./idea-cover-picker";
import { getIdeaCoverPreset, isIdeaCoverPresetId } from "./idea-covers";
import { CoverPickerSheet, type CoverPickerOption } from "./cover-picker";
import { useWorkspace } from "./workspace";
import {
  clearIdeaDraft,
  ideaHasUnsavedChanges,
  loadIdeaDraft,
  saveIdeaDraft,
  type IdeaDraftScope,
} from "./idea-drafts";
import { useUnsavedChangesGuard } from "./navigation-guard";
import {
  addLocalDays,
  addMonths,
  buildMonthGrid,
  formatAdventureCountdown,
  formatAdventureDateTimeRange,
  expandCalendarEventRanges,
  isAdventureHappeningNow,
  isAdventureMemoryEligible,
  monthForDate,
  parseLocalDate,
  sortCalendarEvents,
  toLocalDateKey,
  validateDateTimeRange,
} from "./calendar";
import {
  ConfirmationDialog,
  PageHeader,
  QuickAdd,
  SafeImage,
  Sheet,
  StatusChip,
} from "./components";
import { WeatherIndicator } from "./weather";
import { LocationSearchField } from "./location-search-field";
import { initialLocationDraft } from "./location-field-state";
import { AdventureStopsMapCard } from "./adventure-stops-map-card";
import {
  buildStopMapCameraTarget,
  getItineraryStopColor,
  prepareStopMap,
  reconcileSelectedStopId,
} from "./adventure-stops-map";
import type { StopDraft } from "./repositories/adventure-stops";
import type {
  Adventure,
  AdventureCoverSelection,
  AdventureCoverVariant,
  AdventurePlanInput,
  AdventureStop,
  AdventureLink,
  ChecklistItem,
  Category,
  Idea,
  IdeaStatus,
  MemorySummary,
  SavedLocation,
  LocationDraft,
} from "./types";
const catIcon: Record<string, typeof Heart> = {
  "date-night": Heart,
  "food-drink": Utensils,
  "music-events": Music,
  outdoors: Mountain,
  culture: Palette,
  "at-home": Home,
  "trips-getaways": Plane,
  social: Users,
  errands: ShoppingBag,
};
type ItineraryStopMarkerProps = {
  className: string;
  displayIndex: number;
  isActualFinalStop: boolean;
  stopTitle: string;
  selected?: boolean;
  onActivate?: () => void;
};

function ItineraryStopMarker({
  className,
  displayIndex,
  isActualFinalStop,
  stopTitle,
  selected = false,
  onActivate,
}: ItineraryStopMarkerProps) {
  const markerStyle = {
    "--stop-color": getItineraryStopColor(
      displayIndex,
      isActualFinalStop,
    ),
  } as CSSProperties;
  const label = isActualFinalStop
    ? `Final stop: ${stopTitle}`
    : `Stop ${displayIndex + 1}: ${stopTitle}`;
  const content = isActualFinalStop ? (
    <Flag aria-hidden="true" />
  ) : (
    displayIndex + 1
  );

  return onActivate ? (
    <button
      type="button"
      className={`${className} ${selected ? "selected-stop" : ""}`}
      style={markerStyle}
      aria-label={`${label}. Show on map.`}
      aria-pressed={selected}
      onClick={onActivate}
    >
      {content}
    </button>
  ) : (
    <span
      className={className}
      style={markerStyle}
      aria-label={label}
    >
      {content}
    </span>
  );
}

export function Today() {
  const nav = useNavigate();
  const { activeSpace } = useWorkspace();
  const {
    ideas,
    loading: ideasLoading,
    error: ideasError,
  } = useIdeas();
  const { adventures, loading, error, retry, createAdventure } =
    useAdventureStore();
  const spaceName = activeSpace?.name ?? "Our Adventures";
  const [creating, setCreating] = useState(false);
  const recentIdeas = useMemo(() => selectRecentIdeas(ideas), [ideas]);
  const now = new Date();
  const todayKey = toLocalDateKey(now);
  const upcoming = [...adventures]
    .filter((a) => !a.completed && (isAdventureHappeningNow(a, now) || a.date >= todayKey))
    .sort((a, b) => {
      const activeDifference = Number(isAdventureHappeningNow(b, now)) - Number(isAdventureHappeningNow(a, now));
      return activeDifference || a.date.localeCompare(b.date) || a.startTime.localeCompare(b.startTime);
    });
  const next = upcoming[0];
  const countdownKey = next
    ? `${next.id}:${next.date}:${next.endDate}:${next.startTime}:${next.endTime}`
    : undefined;
  const countdownNow = useMinuteNow(countdownKey);
  const countdown = next
    ? formatAdventureCountdown(next.date, next.startTime, next.endTime, countdownNow, next.endDate)
    : null;
  const createSheet = creating ? (
    <AdventureFormSheet
      title="Plan an Adventure"
      onClose={() => setCreating(false)}
      onSubmit={async (plan) => {
        const created = await createAdventure(plan);
        setCreating(false);
        nav(`/adventures/${created.id}`);
      }}
    />
  ) : null;
  if (loading)
    return (
      <div className="page today">
        <PageHeader
          eyebrow={spaceName}
          eyebrowClassName="today-space-eyebrow"
          title="Your next adventure"
        />
        <div className="ideas-state" role="status">
          <span className="access-spinner" aria-hidden="true" />
          <h3>Gathering your Adventures…</h3>
        </div>
      </div>
    );
  if (error)
    return (
      <div className="page today">
        <PageHeader
          eyebrow={spaceName}
          eyebrowClassName="today-space-eyebrow"
          title="Your next adventure"
        />
        <div className="ideas-state ideas-error" role="alert">
          <h3>Adventures could not be loaded</h3>
          <p>{error}</p>
          <button className="secondary" onClick={() => void retry()}>
            Try again
          </button>
        </div>
      </div>
    );
  if (!next)
    return (
      <div className="page today">
        <PageHeader
          eyebrow={spaceName}
          eyebrowClassName="today-space-eyebrow"
          title="Your next adventure"
          action={
            <button
              className="icon-button"
              onClick={() => setCreating(true)}
              aria-label="Plan an Adventure"
            >
              <Plus />
            </button>
          }
        />
        <div className="ideas-state">
          <Sparkles />
          <h3>No upcoming Adventures yet</h3>
          <p>Choose a date and start planning something worth remembering.</p>
          <button className="primary" onClick={() => setCreating(true)}>
            Plan an Adventure
          </button>
        </div>
        {createSheet}
      </div>
    );
  return (
    <div className="page today">
      <PageHeader
        eyebrow={spaceName}
        eyebrowClassName="today-space-eyebrow"
        title="Your next adventure"
        action={
          <button
            className="icon-button"
            onClick={() => setCreating(true)}
            aria-label="Plan an Adventure"
          >
            <Plus />
          </button>
        }
      />
      <button className="hero" onClick={() => nav(`/adventures/${next.id}`)}>
        <SafeImage
          src={resolveAdventureCover(next)}
          fallbackSrc={GENERIC_ADVENTURE_COVER}
          alt=""
          width={1600}
          height={800}
        />
        <div className="hero-shade" />
        <span className="hero-label">NEXT ADVENTURE</span>
        <div className="hero-copy">
          <h2>{next.title}</h2>
          <p>
            {formatAdventureDateTimeRange({ startDate: next.date, startTime: next.startTime, endDate: next.endDate, endTime: next.endTime })}
          </p>
          <span
            className={`countdown ${countdown?.state ?? "invalid"}`}
            aria-label={countdown?.accessibleLabel}
          >
            {countdown?.label ?? "Time to be confirmed"}
          </span>
        </div>
        <Heart className="hero-heart" />
      </button>
      <SectionTitle
        title="Up Next"
        action={{
          label: "See All",
          to: "/calendar",
          ariaLabel: "See all upcoming adventures",
        }}
      />
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
                {formatAdventureDateTimeRange({ startDate: a.date, startTime: a.startTime, endDate: a.endDate, endTime: a.endTime })}
              </small>
            </span>
            <em>{a.status}</em>
          </button>
        ))}
      </div>
      <SectionTitle
        title="New Ideas"
        action={{ label: "See All", to: "/ideas", ariaLabel: "See all ideas" }}
      />
      {ideasLoading ? (
        <div
          className="idea-rail idea-rail-loading"
          role="status"
          aria-label="Loading new ideas"
        >
          {[0, 1, 2].map((index) => (
            <div className="idea-rail-skeleton" aria-hidden="true" key={index}>
              <span />
              <small />
              <div />
            </div>
          ))}
        </div>
      ) : ideasError ? (
        <p className="today-ideas-state" role="status">
          New ideas are temporarily unavailable.
        </p>
      ) : recentIdeas.length ? (
        <div className="idea-rail">
          {recentIdeas.map((idea) => (
            <button
              className="idea-rail-card"
              key={idea.id}
              onClick={() => nav("/ideas")}
            >
              <IdeaCoverThumbnail
                idea={idea}
                size={58}
                className="mini-art"
              />
              <span className="idea-rail-copy">
                <span className="idea-rail-title">{idea.title}</span>
                <span className="idea-rail-meta">
                  {idea.linkedAdventureId ? (
                    <span className="planned-chip">
                      <Check aria-hidden="true" /> Planned
                    </span>
                  ) : (
                    <StatusChip status={idea.status} />
                  )}
                  <small>Added by {idea.addedBy}</small>
                </span>
              </span>
            </button>
          ))}
        </div>
      ) : (
        <Link
          className="today-ideas-state today-ideas-empty"
          to="/ideas"
          aria-label="No ideas yet — add one for your next adventure."
        >
          No ideas yet — add one for your next adventure.
        </Link>
      )}
      <QuickAdd onClick={() => setCreating(true)} />
      {createSheet}
    </div>
  );
}

function useMinuteNow(refreshKey?: string) {
  const [, setMinuteTick] = useState(0);

  useEffect(() => {
    if (!refreshKey) return;

    let intervalId: number | undefined;
    const timeoutId = window.setTimeout(() => {
      setMinuteTick((current) => current + 1);
      intervalId = window.setInterval(
        () => setMinuteTick((current) => current + 1),
        60_000,
      );
    }, 60_000 - (Date.now() % 60_000));

    return () => {
      window.clearTimeout(timeoutId);
      if (intervalId !== undefined) window.clearInterval(intervalId);
    };
  }, [refreshKey]);

  return new Date();
}

type SectionAction = {
  label: string;
  to: string;
  ariaLabel: string;
};

function SectionTitle({
  title,
  action,
}: {
  title: string;
  action?: SectionAction;
}) {
  return (
    <div className="section-title">
      <h2>{title}</h2>
      {action && (
        <Link className="section-action" to={action.to} aria-label={action.ariaLabel}>
          {action.label}
        </Link>
      )}
    </div>
  );
}
const advancedStatuses: IdeaFilterStatus[] = ["Idea", "Tentative", "Planned", "Confirmed"];
const schedulingOptions: SchedulingFilter[] = ["Upcoming", "Unscheduled", "Past"];

function toggleFilterValue<T>(values: T[], value: T) {
  return values.includes(value)
    ? values.filter((entry) => entry !== value)
    : [...values, value];
}

function AdvancedFiltersPopover({
  filters,
  members,
  onChange,
}: {
  filters: AdvancedIdeaFilters;
  members: SpaceMember[];
  onChange: (filters: AdvancedIdeaFilters) => void;
}) {
  const [open, setOpen] = useState(false);
  const anchorRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const activeCount = countAdvancedIdeaFilters(filters);

  useEffect(() => {
    if (!open) return;
    anchorRef.current?.querySelector<HTMLInputElement>("input")?.focus();
    const onPointerDown = (event: PointerEvent) => {
      if (!anchorRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        triggerRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  return (
    <div className="advanced-filter-anchor" ref={anchorRef}>
      <button
        ref={triggerRef}
        type="button"
        className="search-filter-button"
        aria-label={`Advanced idea filters${activeCount ? `, ${activeCount} active` : ""}`}
        aria-haspopup="dialog"
        aria-expanded={open}
        aria-controls="idea-advanced-filters"
        onClick={() => setOpen((current) => !current)}
      >
        <SlidersHorizontal aria-hidden="true" />
        {activeCount > 0 && <span aria-hidden="true">{activeCount}</span>}
      </button>
      {open && (
        <div className="advanced-filter-popover" id="idea-advanced-filters" role="dialog" aria-label="Advanced idea filters">
          <div className="advanced-filter-heading">
            <strong>Filters</strong>
            <button type="button" disabled={!activeCount} onClick={() => onChange({ ...emptyAdvancedIdeaFilters })}>
              Clear filters
            </button>
          </div>
          <fieldset>
            <legend>Status</legend>
            <div className="filter-options-grid">
              {advancedStatuses.map((status) => (
                <label className="filter-option" key={status}>
                  <input type="checkbox" checked={filters.statuses.includes(status)} onChange={() => onChange({ ...filters, statuses: toggleFilterValue(filters.statuses, status) })} />
                  <span>{status}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Added by</legend>
            <div className="filter-options-list">
              {members.length ? members.map((member) => (
                <label className="filter-option" key={member.userId}>
                  <input type="checkbox" checked={filters.addedByUserIds.includes(member.userId)} onChange={() => onChange({ ...filters, addedByUserIds: toggleFilterValue(filters.addedByUserIds, member.userId) })} />
                  <span>{member.displayName || "Adventure Planner"}</span>
                </label>
              )) : <small>Member filters are unavailable.</small>}
            </div>
          </fieldset>
          <fieldset>
            <legend>Scheduling</legend>
            <div className="filter-options-grid">
              {schedulingOptions.map((scheduling) => (
                <label className="filter-option" key={scheduling}>
                  <input type="checkbox" checked={filters.scheduling.includes(scheduling)} onChange={() => onChange({ ...filters, scheduling: toggleFilterValue(filters.scheduling, scheduling) })} />
                  <span>{scheduling}</span>
                </label>
              ))}
            </div>
          </fieldset>
          <fieldset>
            <legend>Additional</legend>
            <div className="filter-options-list">
              <label className="filter-option">
                <input type="checkbox" checked={filters.dateNightOnly} onChange={(event) => onChange({ ...filters, dateNightOnly: event.target.checked })} />
                <span>Date Night only</span>
              </label>
            </div>
          </fieldset>
        </div>
      )}
    </div>
  );
}

type IdeaMenuAction = "edit" | "duplicate";

function IdeaActionsMenu({
  ideaTitle,
  onAction,
}: {
  ideaTitle: string;
  onAction: (action: IdeaMenuAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const menuId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus(),
    );
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (action: IdeaMenuAction) => {
    setOpen(false);
    onAction(action);
  };
  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
    );
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next = event.key === "Home"
      ? 0
      : event.key === "End"
        ? items.length - 1
        : event.key === "ArrowDown"
          ? (current + 1) % items.length
          : (current - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div className="idea-actions" ref={containerRef}>
      <button
        ref={triggerRef}
        type="button"
        className="idea-actions-trigger"
        aria-label={`More actions for ${ideaTitle}`}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls={menuId}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal aria-hidden="true" />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="adventure-actions-menu idea-actions-menu"
          id={menuId}
          role="menu"
          aria-label={`Actions for ${ideaTitle}`}
          onKeyDown={onMenuKeyDown}
        >
          <button role="menuitem" type="button" onClick={() => choose("edit")}>
            <Pencil aria-hidden="true" /> Edit idea
          </button>
          <button role="menuitem" type="button" onClick={() => choose("duplicate")}>
            <Copy aria-hidden="true" /> Duplicate idea
          </button>
        </div>
      )}
    </div>
  );
}

const blankIdea: Idea = {
  id: "",
  title: "",
  description: "",
  category: "food-drink",
  status: "Idea",
  tags: [],
  addedBy: "Adventure Planner",
  isDateNight: false,
  createdAt: "2026-07-12",
};
type IdeaEditorState = {
  idea: Idea;
  mode: IdeaDraftScope["mode"];
  sourceIdeaId?: string;
};

export function Ideas() {
  const nav = useNavigate();
  const {
    ideas,
    loading,
    error,
    retry,
    saveIdea,
    deleteIdea,
    markIdeaPromoted,
  } = useIdeas();
  const { activeSpace, memberships, profile } = useWorkspace();
  const { promoteIdeaToAdventure } = useAdventureStore();
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<IdeaCategoryFilter>("all");
  const [advancedFilters, setAdvancedFilters] = useState<AdvancedIdeaFilters>({ ...emptyAdvancedIdeaFilters });
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [editor, setEditor] = useState<IdeaEditorState | null>(null);
  const [planning, setPlanning] = useState<Idea | null>(null);
  const canDeleteIdeas = Boolean(
    activeSpace &&
      memberships.some((membership) => membership.spaceId === activeSpace.id),
  );

  useEffect(() => {
    if (!activeSpace) return;
    let active = true;
    void loadSpaceMembers(activeSpace.id)
      .then((nextMembers) => { if (active) setMembers(nextMembers); })
      .catch(() => { if (active) setMembers([]); });
    return () => { active = false; };
  }, [activeSpace]);

  const activeIdeas = useMemo(() => ideas.filter(isActiveIdea), [ideas]);
  const counts = useMemo(
    () => activeIdeas.reduce<Record<string, number>>((result, idea) => {
      result[idea.category] = (result[idea.category] || 0) + 1;
      if (idea.isDateNight) result["date-night"] = (result["date-night"] || 0) + 1;
      return result;
    }, { all: activeIdeas.length }),
    [activeIdeas],
  );
  const shown = useMemo(
    () => filterIdeas(ideas, filter, query, advancedFilters),
    [advancedFilters, filter, ideas, query],
  );
  const creatorNames = useMemo(
    () => new Map(members.map((member) => [member.userId, member.displayName])),
    [members],
  );
  const categoryFilters: { id: IdeaCategoryFilter; label: string }[] = [
    { id: "all", label: "All Ideas" },
    { id: "date-night", label: "Date Night" },
    ...primaryCategories,
  ];
  return (
    <div className="page ideas">
      <PageHeader
        title="Ideas"
        action={
          <button
            className="icon-button"
            onClick={() => setEditor({ idea: { ...blankIdea }, mode: "create" })}
            aria-label="Add idea"
          >
            <Plus />
          </button>
        }
      />
      <div className="search">
        <Search aria-hidden="true" />
        <input
          aria-label="Search shared ideas"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search shared ideas"
        />
        <AdvancedFiltersPopover
          filters={advancedFilters}
          members={members}
          onChange={setAdvancedFilters}
        />
      </div>
      <div className="category-grid">
        {categoryFilters.map((category, n) => {
          const Icon = catIcon[category.id] || Sparkles;
          return (
            <button
              className={`category-tile t${n} ${filter === category.id ? "selected" : ""}`}
              key={category.id}
              aria-pressed={filter === category.id}
              onClick={() => setFilter(category.id)}
            >
              <Icon aria-hidden="true" />
              <span>{category.label}</span>
              <b>{counts[category.id] || 0}</b>
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
            onClick={() => setEditor({ idea: { ...blankIdea }, mode: "create" })}
          >
            Add your first idea
          </button>
        </div>
      ) : shown.length === 0 ? (
        <div className="ideas-state">
          <Search aria-hidden="true" />
          <h3>No matching ideas</h3>
          <p>Try another search or adjust your filters.</p>
        </div>
      ) : (
        <div className="idea-list">
          {shown.map((i) => (
            <article
              className="idea-card"
              data-idea-id={i.id}
              key={i.id}
            >
              <button
                type="button"
                className="idea-card-open"
                aria-label={`Edit ${i.title}`}
                onClick={() => setEditor({ idea: i, mode: "edit" })}
              >
                <IdeaCoverThumbnail
                  idea={i}
                  size={64}
                  className="idea-thumb"
                />
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
                    <small>Added by {i.addedByUserId ? creatorNames.get(i.addedByUserId) || i.addedBy : i.addedBy}</small>
                  </div>
                  {!i.linkedAdventureId && i.proposedStartDate && (
                    <small className="idea-proposed-date">
                      Proposed · {formatAdventureDateTimeRange({
                        startDate: i.proposedStartDate,
                        startTime: i.proposedStartTime,
                        endDate: i.proposedEndDate,
                        endTime: i.proposedEndTime,
                      })}
                    </small>
                  )}
                </div>
              </button>
              <IdeaActionsMenu
                ideaTitle={i.title}
                onAction={(action) => {
                  if (action === "edit") {
                    setEditor({ idea: i, mode: "edit" });
                    return;
                  }
                  setEditor({
                    idea: duplicateIdeaForEditing(
                      i,
                      ideas.map((idea) => idea.title),
                      profile
                        ? { id: profile.id, displayName: profile.displayName || i.addedBy }
                        : undefined,
                    ),
                    mode: "duplicate",
                    sourceIdeaId: i.id,
                  });
                }}
              />
            </article>
          ))}
        </div>
      )}
      <QuickAdd onClick={() => setEditor({ idea: { ...blankIdea }, mode: "create" })} />
      <IdeaSheet
        idea={editor?.idea ?? null}
        mode={editor?.mode}
        draftScope={profile && activeSpace ? {
          userId: profile.id,
          spaceId: activeSpace.id,
          mode: editor?.mode ?? "create",
          ideaId: editor?.mode === "duplicate"
            ? editor.sourceIdeaId
            : editor?.idea.id || undefined,
        } : undefined}
        onClose={() => setEditor(null)}
        onSave={saveIdea}
        onDelete={deleteIdea}
        canDelete={canDeleteIdeas}
        onPlan={(idea) => {
          setEditor(null);
          setPlanning(idea);
        }}
        onView={(id) => nav(`/adventures/${id}`)}
      />
      {planning && (
        <AdventureFormSheet
          title="Turn into an Adventure"
          idea={planning}
          onClose={() => setPlanning(null)}
          onSubmit={async (plan) => {
            const created = await promoteAndReconcileIdea({
              ideaId: planning.id,
              plan: {
                ...plan,
                category: planning.category,
                coverImage: planning.optionalImage,
              },
              promote: promoteIdeaToAdventure,
              reconcile: markIdeaPromoted,
            });
            setPlanning(null);
            nav(`/adventures/${created.id}`);
          }}
        />
      )}
    </div>
  );
}
type IdeaSheetProps = {
  idea: Idea | null;
  mode?: IdeaDraftScope["mode"];
  draftScope?: IdeaDraftScope;
  onClose: () => void;
  onSave: (i: Idea) => Promise<void>;
  onDelete: (id: string) => Promise<void>;
  canDelete: boolean;
  onPlan: (idea: Idea) => void;
  onView: (id: string) => void;
};

export function IdeaSheet(props: IdeaSheetProps) {
  if (!props.idea) return null;
  const key = `${props.draftScope?.userId ?? "none"}:${props.draftScope?.spaceId ?? "none"}:${props.mode ?? props.draftScope?.mode ?? "none"}:${props.idea.id || "new"}`;
  return <IdeaSheetContent key={key} {...props} idea={props.idea} />;
}

function IdeaSheetContent({
  idea,
  mode,
  draftScope,
  onClose,
  onSave,
  onDelete,
  canDelete,
  onPlan,
  onView,
}: Omit<IdeaSheetProps, "idea"> & { idea: Idea }) {
  const [initial] = useState(() => {
    if (!draftScope) return { draft: idea, notice: null as string | null };
    try {
      const loaded = loadIdeaDraft(window.localStorage, draftScope, idea);
      return {
        draft: loaded.status === "restored" ? loaded.idea : idea,
        notice:
          loaded.status === "restored"
            ? "Unsaved draft restored."
            : loaded.status === "stale"
              ? "A saved draft was older than this idea and was not restored."
              : null,
      };
    } catch {
      return { draft: idea, notice: null as string | null };
    }
  });
  const [draft, setDraft] = useState<Idea>(initial.draft);
  const [baseline, setBaseline] = useState<Idea>(idea);
  const [draftNotice, setDraftNotice] = useState<string | null>(initial.notice);
  const [pendingExit, setPendingExit] = useState<(() => void) | null>(null);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [changingCover, setChangingCover] = useState(false);
  const [urlError, setUrlError] = useState<string | null>(null);
  const [dateErrors, setDateErrors] = useState<ReturnType<typeof validateDateTimeRange>>({});
  const urlErrorId = useId();
  const dirty = ideaHasUnsavedChanges(draft, baseline);

  const clearStoredDraft = useCallback(() => {
    if (!draftScope) return;
    try {
      clearIdeaDraft(window.localStorage, draftScope);
    } catch {
      // Storage may be unavailable in private or constrained browser modes.
    }
  }, [draftScope]);

  const discard = useCallback(() => {
    clearStoredDraft();
    setDraft(baseline);
    setDraftNotice(null);
  }, [baseline, clearStoredDraft]);

  useUnsavedChangesGuard(
    {
      isDirty: () => dirty,
      discard: () => {
        discard();
        onClose();
      },
    },
  );

  useEffect(() => {
    if (!draftScope || !draft || !baseline || !dirty) return;
    const timer = window.setTimeout(() => {
      try {
        saveIdeaDraft(window.localStorage, draftScope, {
          ...draft,
          updatedAt: baseline.updatedAt,
        });
      } catch {
        // Unsaved-change protection still works when storage is unavailable.
      }
    }, 200);
    return () => window.clearTimeout(timer);
  }, [baseline, dirty, draft, draftScope]);

  const wasDirty = useRef(false);
  useEffect(() => {
    if (dirty) {
      wasDirty.current = true;
    } else if (wasDirty.current) {
      clearStoredDraft();
      wasDirty.current = false;
    }
  }, [clearStoredDraft, dirty]);

  const d = draft;
  const coverLabel = isIdeaCoverPresetId(d.coverPresetId)
    ? getIdeaCoverPreset(d.coverPresetId).label
    : "Automatic cover";
  const externalUrl = safeIdeaUrl(d.optionalLink);
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (saving) return;
    const normalizedUrl = normalizeIdeaUrl(d.optionalLink);
    setUrlError(normalizedUrl.error);
    const nextDateErrors = validateDateTimeRange({
      startDate: d.proposedStartDate,
      startTime: d.proposedStartTime,
      endDate: d.proposedEndDate,
      endTime: d.proposedEndTime,
      requireStartDate: false,
    });
    setDateErrors(nextDateErrors);
    if (normalizedUrl.error || Object.keys(nextDateErrors).length) return;
    const normalizedDraft = { ...d, optionalLink: normalizedUrl.url };
    setSaving(true);
    setSaveError(null);
    try {
      await onSave(normalizedDraft);
      clearStoredDraft();
      setBaseline(normalizedDraft);
      setDraft(normalizedDraft);
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
  const confirmDelete = async () => {
    if (deleting || !idea.id) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await onDelete(idea.id);
      clearStoredDraft();
      setConfirmingDelete(false);
      onClose();
    } catch (error) {
      setDeleteError(
        error instanceof Error
          ? error.message
          : "We could not delete this idea. Please try again.",
      );
    } finally {
      setDeleting(false);
    }
  };
  const requestExit = (action: () => void) => {
    if (!dirty) {
      action();
      return;
    }
    setPendingExit(() => action);
  };
  return (
    <Sheet
      open
      title={mode === "duplicate" ? "Duplicate idea" : idea.id ? "Edit idea" : "Add an idea"}
      onClose={() => requestExit(onClose)}
    >
      <form className="idea-form" onSubmit={submit} noValidate>
        {draftNotice && <p className="form-notice" role="status">{draftNotice}</p>}
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
              {primaryCategories.map((category) => (
                <option key={category.id} value={category.id}>{category.label}</option>
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
        <label
          className={`date-night-field ${d.isDateNight ? "selected" : ""}`}
        >
          <Heart aria-hidden="true" />
          <span>
            <strong>Date Night</strong>
            <small>Mark this as a date idea</small>
          </span>
          <input
            type="checkbox"
            checked={d.isDateNight}
            onChange={(e) => setDraft({ ...d, isDateNight: e.target.checked })}
          />
        </label>
        <fieldset className="proposed-date-fields">
          <legend>Proposed date <span>Optional</span></legend>
          <div className="form-row">
            <label>
              Start date
              <input
                type="date"
                value={d.proposedStartDate ?? ""}
                aria-invalid={Boolean(dateErrors.startDate)}
                onChange={(event) => {
                  const proposedStartDate = event.target.value || undefined;
                  setDraft({
                    ...d,
                    proposedStartDate,
                    ...(!proposedStartDate ? {
                      proposedStartTime: undefined,
                      proposedEndDate: undefined,
                      proposedEndTime: undefined,
                    } : {}),
                  });
                }}
              />
              {dateErrors.startDate && <span className="field-error">{dateErrors.startDate}</span>}
            </label>
            {d.proposedStartDate && <label>
              Start time <span className="optional-label">Optional</span>
              <input type="time" value={d.proposedStartTime ?? ""} onChange={(event) => setDraft({ ...d, proposedStartTime: event.target.value || undefined })} />
            </label>}
          </div>
          {d.proposedStartDate && <div className="form-row">
            <label>
              End date <span className="optional-label">Optional</span>
              <input
                type="date"
                min={d.proposedStartDate}
                value={d.proposedEndDate ?? ""}
                aria-invalid={Boolean(dateErrors.endDate)}
                onChange={(event) => {
                  const proposedEndDate = event.target.value || undefined;
                  setDraft({ ...d, proposedEndDate, proposedEndTime: proposedEndDate ? d.proposedEndTime : undefined });
                }}
              />
              {dateErrors.endDate && <span className="field-error">{dateErrors.endDate}</span>}
            </label>
            {d.proposedEndDate && <label>
              End time <span className="optional-label">Optional</span>
              <input type="time" value={d.proposedEndTime ?? ""} aria-invalid={Boolean(dateErrors.endTime)} onChange={(event) => setDraft({ ...d, proposedEndTime: event.target.value || undefined })} />
              {dateErrors.endTime && <span className="field-error">{dateErrors.endTime}</span>}
            </label>}
          </div>}
        </fieldset>
        <label>
          Website or link
          <input
            type="url"
            inputMode="url"
            placeholder="https://example.com"
            value={d.optionalLink ?? ""}
            aria-invalid={Boolean(urlError)}
            aria-describedby={urlError ? urlErrorId : undefined}
            onBlur={() => setUrlError(normalizeIdeaUrl(d.optionalLink).error)}
            onChange={(event) => {
              const optionalLink = event.target.value;
              setDraft({ ...d, optionalLink });
              if (urlError) setUrlError(normalizeIdeaUrl(optionalLink).error);
            }}
          />
          {urlError && (
            <span className="field-error" id={urlErrorId} role="alert">
              {urlError}
            </span>
          )}
        </label>
        {externalUrl && (
          <a
            className="idea-external-link"
            href={externalUrl}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open link for ${d.title || "this idea"} in a new tab`}
            onClick={(event) => event.stopPropagation()}
          >
            <ExternalLink aria-hidden="true" />
            <span>Open link</span>
          </a>
        )}
        {idea.id && (
          <div className="idea-cover-field">
            <span className="idea-cover-field-label">Cover</span>
            <button
              type="button"
              className="idea-cover-control"
              aria-label="Change idea cover"
              disabled={saving}
              onClick={() => setChangingCover(true)}
            >
              <IdeaCoverThumbnail
                idea={d}
                size={52}
                className="idea-cover-field-thumbnail"
              />
              <strong>{coverLabel}</strong>
              <span className="idea-cover-change">Change</span>
            </button>
          </div>
        )}
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
            {idea.linkedAdventureId ? (
              <button
                type="button"
                className="text-action idea-promotion-action"
                onClick={() => requestExit(() => onView(idea.linkedAdventureId!))}
              >
                View adventure <ChevronRight />
              </button>
            ) : (
              <button
                type="button"
                className="text-action idea-promotion-action"
                onClick={() => requestExit(() => onPlan(d))}
              >
                Turn into an adventure <ChevronRight />
              </button>
            )}
            {canDelete && (
              <div className="idea-delete-section">
                <button
                  type="button"
                  className="idea-delete-action"
                  disabled={saving}
                  onClick={() => {
                    setDeleteError(null);
                    setConfirmingDelete(true);
                  }}
                >
                  <Trash2 aria-hidden="true" />
                  Delete idea
                </button>
              </div>
            )}
          </>
        )}
      </form>
      <ConfirmationDialog
        open={confirmingDelete}
        title={`Delete “${idea.title}”?`}
        body="This idea will be permanently deleted. This cannot be undone."
        confirmLabel="Delete idea"
        pendingLabel="Deleting…"
        pending={deleting}
        error={deleteError}
        onCancel={() => {
          if (deleting) return;
          setConfirmingDelete(false);
          setDeleteError(null);
        }}
        onConfirm={() => void confirmDelete()}
      />
      <ConfirmationDialog
        open={Boolean(pendingExit)}
        title="Discard unsaved changes?"
        body="Your changes have not been saved."
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        pendingLabel="Discarding…"
        onCancel={() => setPendingExit(null)}
        onConfirm={() => {
          const action = pendingExit;
          setPendingExit(null);
          discard();
          action?.();
        }}
      />
      {changingCover && (
        <IdeaCoverPicker
          idea={d}
          onClose={() => setChangingCover(false)}
          onSave={async (coverPresetId) => {
            await onSave({ ...idea, coverPresetId });
            setBaseline((current) => current ? { ...current, coverPresetId } : current);
            setDraft({ ...d, coverPresetId });
          }}
        />
      )}
    </Sheet>
  );
}
type AdventureFormErrors = Partial<
  Record<"title" | "date" | "startTime" | "endDate" | "endTime" | "form", string>
>;

function AdventureFormSheet({
  title,
  idea,
  initialPlan,
  savedLocation = { kind: "none", label: "" },
  adventureId,
  submitLabel = "Create Adventure",
  savingLabel = "Creating…",
  onClose,
  onSubmit,
}: {
  title: string;
  idea?: Idea;
  initialPlan?: AdventurePlanInput;
  savedLocation?: SavedLocation;
  adventureId?: string;
  submitLabel?: string;
  savingLabel?: string;
  onClose: () => void;
  onSubmit: (plan: AdventurePlanInput) => Promise<void>;
}) {
  const { activeSpace } = useWorkspace();
  const [plan, setPlan] = useState<AdventurePlanInput>(() => {
    const base = initialPlan ?? {
      title: idea?.title || "",
      description: idea?.description || "",
      date: idea?.proposedStartDate || "",
      endDate: idea?.proposedEndDate || "",
      startTime: idea?.proposedStartTime?.slice(0, 5) || "",
      endTime: idea?.proposedEndTime?.slice(0, 5) || "",
      status: "Tentative",
      location: idea?.optionalLocation || "",
      notes: "",
      category: idea?.category || "culture",
      coverImage: idea?.optionalImage,
    };
    return {
      ...base,
      locationDraft:
        base.locationDraft ??
        initialLocationDraft(savedLocation, base.location),
    };
  });
  const [errors, setErrors] = useState<AdventureFormErrors>({});
  const [saving, setSaving] = useState(false);
  const update = <K extends keyof AdventurePlanInput>(
    key: K,
    value: AdventurePlanInput[K],
  ) => setPlan((current) => ({ ...current, [key]: value }));
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: AdventureFormErrors = {};
    if (!plan.title.trim()) nextErrors.title = "Enter a title.";
    const rangeErrors = validateDateTimeRange({
      startDate: plan.date,
      startTime: plan.startTime,
      endDate: plan.endDate,
      endTime: plan.endTime,
    });
    if (rangeErrors.startDate) nextErrors.date = rangeErrors.startDate;
    if (rangeErrors.startTime) nextErrors.startTime = rangeErrors.startTime;
    if (rangeErrors.endDate) nextErrors.endDate = rangeErrors.endDate;
    if (rangeErrors.endTime) nextErrors.endTime = rangeErrors.endTime;
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || saving) return;
    setSaving(true);
    try {
      await onSubmit(plan);
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : `We could not ${submitLabel.toLowerCase()}.`,
      });
    } finally {
      setSaving(false);
    }
  };
  return (
    <Sheet open title={title} onClose={onClose}>
      <form className="idea-form planning-form" onSubmit={submit} noValidate>
        <label>
          Title
          <input
            aria-label="Adventure title"
            value={plan.title}
            onChange={(event) => update("title", event.target.value)}
            aria-invalid={!!errors.title}
          />
          {errors.title && <span className="field-error">{errors.title}</span>}
        </label>
        <label>
          Description
          <textarea
            aria-label="Adventure description"
            value={plan.description}
            onChange={(event) => update("description", event.target.value)}
          />
        </label>
        <label>
          Category
          <select
            aria-label="Adventure category"
            value={plan.category ?? "culture"}
            onChange={(event) => {
              const category = event.target.value as Category;
              setPlan((current) => ({
                ...current,
                category,
                coverVariant:
                  current.category === category
                    ? current.coverVariant
                    : undefined,
              }));
            }}
          >
            {primaryCategories.map((category) => (
              <option key={category.id} value={category.id}>
                {category.label}
              </option>
            ))}
          </select>
        </label>
        <div className="form-row">
          <label>
            Start date
            <input
              aria-label="Adventure start date"
              type="date"
              value={plan.date}
              onChange={(event) => update("date", event.target.value)}
              aria-invalid={!!errors.date}
            />
            {errors.date && <span className="field-error">{errors.date}</span>}
          </label>
          <label>
            Status
            <select
              aria-label="Adventure status"
              value={plan.status}
              onChange={(event) =>
                update(
                  "status",
                  event.target.value as AdventurePlanInput["status"],
                )
              }
            >
              <option>Tentative</option>
              <option>Confirmed</option>
            </select>
          </label>
        </div>
        <div className="form-row">
          <label>
            Start time
            <input
              aria-label="Adventure start time"
              type="time"
              value={plan.startTime}
              onChange={(event) => update("startTime", event.target.value)}
              aria-invalid={!!errors.startTime}
            />
            {errors.startTime && (
              <span className="field-error">{errors.startTime}</span>
            )}
          </label>
          <label>
            End date <span className="optional-label">Optional</span>
            <input
              aria-label="Adventure end date"
              type="date"
              min={plan.date}
              value={plan.endDate}
              onChange={(event) => {
                const endDate = event.target.value;
                setPlan((current) => ({ ...current, endDate, endTime: endDate ? current.endTime : "" }));
              }}
              aria-invalid={!!errors.endDate}
            />
            {errors.endDate && <span className="field-error">{errors.endDate}</span>}
          </label>
          {plan.endDate && <label>
            End time <span className="optional-label">Optional</span>
            <input
              aria-label="Adventure end time"
              type="time"
              value={plan.endTime}
              onChange={(event) => update("endTime", event.target.value)}
              aria-invalid={!!errors.endTime}
            />
            {errors.endTime && (
              <span className="field-error">{errors.endTime}</span>
            )}
          </label>}
        </div>
        <LocationSearchField
          id="adventure-location"
          spaceId={activeSpace?.id ?? ""}
          adventureId={adventureId}
          savedLocation={savedLocation}
          draft={
            plan.locationDraft ??
            initialLocationDraft(savedLocation, plan.location)
          }
          onChange={(locationDraft) =>
            setPlan((current) => ({
              ...current,
              location: locationDraft.label,
              locationDraft,
            }))
          }
          textOnlyWarning="Saved as text only. Select a result to show it on the map and use it for location-based weather."
        />
        <label>
          Notes
          <textarea
            aria-label="Adventure notes"
            value={plan.notes}
            onChange={(event) => update("notes", event.target.value)}
          />
        </label>
        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}
        <div className="sheet-actions">
          <button className="secondary" type="button" onClick={onClose}>
            Cancel
          </button>
          <button className="primary" type="submit" disabled={saving}>
            {saving ? savingLabel : submitLabel}
          </button>
        </div>
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
  const { calendarEvents, calendarTargetDate, loading, error, retry, promoteIdeaToAdventure } =
    useAdventureStore();
  const {
    ideas,
    saveIdea,
    deleteIdea,
    retry: retryIdeas,
    loading: ideasLoading,
    error: ideasError,
    markIdeaPromoted,
  } = useIdeas();
  const { activeSpace, memberships, profile } = useWorkspace();
  const [editingIdea, setEditingIdea] = useState<Idea | null>(null);
  const [planningIdea, setPlanningIdea] = useState<Idea | null>(null);
  const todayKey = toLocalDateKey(new Date());
  const initialDate = calendarTargetDate || todayKey;
  const [selectedDate, setSelectedDate] = useState(initialDate);
  const [visibleMonth, setVisibleMonth] = useState(() =>
    monthForDate(initialDate),
  );

  const monthDays = useMemo(() => buildMonthGrid(visibleMonth), [visibleMonth]);
  const allCalendarEvents = useMemo(() => expandCalendarEventRanges([
    ...calendarEvents,
    ...selectCalendarProposalIdeas(ideas).map((idea) => ({
      id: `proposal-${idea.id}`,
      title: idea.title,
      subtitle: "Proposed idea",
      date: idea.proposedStartDate!,
      endDate: idea.proposedEndDate,
      startTime: idea.proposedStartTime,
      endTime: idea.proposedEndTime,
      category: idea.category,
      status: idea.status,
      ideaId: idea.id,
      kind: "proposal" as const,
      allDay: !idea.proposedStartTime,
    })),
  ]), [calendarEvents, ideas]);
  const eventsByDate = useMemo(() => {
    const grouped = new Map<string, typeof allCalendarEvents>();
    for (const event of allCalendarEvents) {
      const existing = grouped.get(event.date) || [];
      grouped.set(event.date, [...existing, event]);
    }
    return grouped;
  }, [allCalendarEvents]);
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
      {(loading || ideasLoading) && (
        <p className="inline-state" role="status">
          Loading Adventures…
        </p>
      )}
      {(error || ideasError) && (
        <div className="ideas-state ideas-error" role="alert">
          <p>{error || ideasError}</p>
          <button onClick={() => void Promise.all([retry(), retryIdeas()])}>Try again</button>
        </div>
      )}
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
              {eventCount > 0 && (
                <span className="event-dots" aria-hidden="true">
                  {eventsByDate.get(day.key)?.some((event) => event.kind !== "proposal") && <i className="event-dot" />}
                  {eventsByDate.get(day.key)?.some((event) => event.kind === "proposal") && <i className="event-dot proposal" />}
                </span>
              )}
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
              key={`${event.id}-${event.date}`}
              className={`agenda-row ${event.status.toLowerCase()} ${event.category.replaceAll(" ", "-").replace("&", "and")} ${event.kind === "proposal" ? "proposal" : ""}`}
              onClick={() => {
                if (event.ideaId) setEditingIdea(ideas.find((idea) => idea.id === event.ideaId) ?? null);
                else if (event.adventureId) nav(`/adventures/${event.adventureId}`);
              }}
            >
              <span className="agenda-time">
                {event.kind === "proposal" ? "Proposed" : event.allDay ? "All day" : event.startTime || "Time TBD"}
              </span>
              <span className="agenda-copy">
                <b>{event.title}</b>
                <small>
                  {formatAdventureDateTimeRange({ startDate: event.originalDate ?? event.date, startTime: event.startTime, endDate: event.endDate, endTime: event.endTime })}
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
      <IdeaSheet
        idea={editingIdea}
        mode="edit"
        draftScope={editingIdea && profile && activeSpace ? { userId: profile.id, spaceId: activeSpace.id, mode: "edit", ideaId: editingIdea.id } : undefined}
        onClose={() => setEditingIdea(null)}
        onSave={saveIdea}
        onDelete={deleteIdea}
        canDelete={Boolean(activeSpace && memberships.some((membership) => membership.spaceId === activeSpace.id))}
        onPlan={(idea) => { setEditingIdea(null); setPlanningIdea(idea); }}
        onView={(id) => nav(`/adventures/${id}`)}
      />
      {planningIdea && <AdventureFormSheet
        title="Turn idea into an Adventure"
        idea={planningIdea}
        onClose={() => setPlanningIdea(null)}
        onSubmit={async (plan) => {
          const created = await promoteAndReconcileIdea({
            ideaId: planningIdea.id,
            plan,
            promote: promoteIdeaToAdventure,
            reconcile: markIdeaPromoted,
          });
          setPlanningIdea(null);
          nav(`/adventures/${created.id}`);
        }}
      />}
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
  locationDraft: LocationDraft;
};

type StopTextField = Exclude<keyof StopFormValue, "locationDraft">;

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
  adventureId,
  stop,
  onClose,
  onSave,
}: {
  adventureId: string;
  stop?: AdventureStop;
  onClose: () => void;
  onSave: (stop: StopDraft) => Promise<void>;
}) {
  const { activeSpace } = useWorkspace();
  const savedLocation: SavedLocation = stop?.savedLocation ?? {
    kind: "none",
    label: "",
  };
  const [value, setValue] = useState<StopFormValue>(() => ({
    title: stop?.title || "",
    location: stop?.location || "",
    startTime: timeToInput(stop?.startTime),
    endTime: timeToInput(stop?.endTime),
    notes: stop?.notes || "",
    travelMinutes: stop?.optionalTravelTime?.match(/\d+/)?.[0] || "",
    locationDraft: initialLocationDraft(savedLocation, stop?.location ?? ""),
  }));
  const [errors, setErrors] = useState<{
    title?: string;
    endTime?: string;
    travelMinutes?: string;
    form?: string;
  }>({});
  const [saving, setSaving] = useState(false);
  const update = (key: StopTextField, next: string) => {
    setValue((current) => ({ ...current, [key]: next }));
    if (key in errors)
      setErrors((current) => ({ ...current, [key]: undefined }));
  };
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors: typeof errors = {};
    if (!value.title.trim()) nextErrors.title = "Enter a stop title.";
    if (value.endTime && value.startTime && value.endTime < value.startTime)
      nextErrors.endTime = "End time must be later than the start time.";
    if (value.travelMinutes && Number(value.travelMinutes) < 0)
      nextErrors.travelMinutes = "Travel time cannot be negative.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length || saving) return;
    setSaving(true);
    try {
      await onSave({
        title: value.title.trim(),
        location: value.location.trim(),
        startTime: timeFromInput(value.startTime),
        endTime: timeFromInput(value.endTime) || undefined,
        notes: value.notes.trim() || undefined,
        optionalTravelTime: value.travelMinutes
          ? `${Number(value.travelMinutes)} min`
          : undefined,
        locationDraft: value.locationDraft,
      });
    } catch (error) {
      setErrors({
        form:
          error instanceof Error
            ? error.message
            : "We could not save this stop.",
      });
    } finally {
      setSaving(false);
    }
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
        <LocationSearchField
          id="stop-location"
          spaceId={activeSpace?.id ?? ""}
          adventureId={adventureId}
          savedLocation={savedLocation}
          draft={value.locationDraft}
          onChange={(locationDraft) =>
            setValue((current) => ({
              ...current,
              location: locationDraft.label,
              locationDraft,
            }))
          }
          textOnlyWarning="Saved as text only. Select a result to show this stop on the map."
        />
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
          <button className="primary" type="submit" disabled={saving}>
            {saving ? "Saving…" : stop ? "Save changes" : "Add stop"}
          </button>
        </div>
        {errors.form && (
          <p className="form-error" role="alert">
            {errors.form}
          </p>
        )}
      </form>
    </Sheet>
  );
}

function ChecklistPanel({ items, loading, error, onRetry, onAdd, onEdit, onToggle, onDelete, onReorder }: {
  items: ChecklistItem[]; loading: boolean; error: string | null;
  onRetry: () => Promise<void>; onAdd: (label: string) => Promise<void>;
  onEdit: (id: string, label: string) => Promise<void>; onToggle: (id: string) => Promise<void>;
  onDelete: (id: string) => Promise<void>; onReorder: (id: string, direction: -1 | 1) => Promise<void>;
}) {
  const [label, setLabel] = useState("");
  const [editing, setEditing] = useState<ChecklistItem | null>(null);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const ordered = [...items].sort((a, b) => a.sortOrder - b.sortOrder);
  const completed = items.filter((item) => item.completed).length;
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const next = label.trim();
    if (!next) { setMessage("Enter a checklist item."); return; }
    setSaving(true); setMessage(null);
    try { if (editing) await onEdit(editing.id, next); else await onAdd(next); setLabel(""); setEditing(null); }
    catch (nextError) { setMessage(nextError instanceof Error ? nextError.message : "We could not save this item."); }
    finally { setSaving(false); }
  };
  return <div className="tab-panel checklist-live">
    <div className="panel-heading"><div><h2>Shared checklist</h2><p>{items.length ? `${completed} of ${items.length} complete` : "Pack the little things together."}</p></div></div>
    {loading && <p className="inline-state" role="status">Loading checklist…</p>}
    {error && <div className="inline-error" role="alert"><span>{error}</span><button onClick={() => void onRetry()}>Retry</button></div>}
    {!loading && !error && !ordered.length && <div className="compact-empty"><Check /><p>No checklist items yet.</p></div>}
    <div className="checklist-items">{ordered.map((item, index) => <div className="checklist-item" key={item.id}>
      <label><input type="checkbox" checked={item.completed} onChange={() => void onToggle(item.id)} aria-label={`${item.completed ? "Mark incomplete" : "Mark complete"}: ${item.label}`} /><span>{item.label}</span></label>
      <div className="item-actions">
        <button disabled={index === 0} onClick={() => void onReorder(item.id, -1)} aria-label={`Move ${item.label} up`}><ChevronUp /></button>
        <button disabled={index === ordered.length - 1} onClick={() => void onReorder(item.id, 1)} aria-label={`Move ${item.label} down`}><ChevronDown /></button>
        <button onClick={() => { setEditing(item); setLabel(item.label); }} aria-label={`Edit ${item.label}`}><Pencil /></button>
        <button onClick={() => { if (window.confirm(`Delete “${item.label}”?`)) void onDelete(item.id); }} aria-label={`Delete ${item.label}`}><Trash2 /></button>
      </div>
    </div>)}</div>
    <form className="child-form" onSubmit={submit}><label><span>{editing ? "Edit item" : "New item"}</span><input value={label} onChange={(event) => setLabel(event.target.value)} disabled={saving} /></label><button className="primary" disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Add item"}</button>{editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setLabel(""); }}>Cancel</button>}</form>
    {message && <p className="form-error" role="alert">{message}</p>}
  </div>;
}

function LinksPanel({ links, loading, error, onRetry, onAdd, onEdit, onDelete }: {
  links: AdventureLink[]; loading: boolean; error: string | null; onRetry: () => Promise<void>;
  onAdd: (label: string, url: string) => Promise<void>; onEdit: (id: string, label: string, url: string) => Promise<void>; onDelete: (id: string) => Promise<void>;
}) {
  const [label, setLabel] = useState(""); const [url, setUrl] = useState("");
  const [editing, setEditing] = useState<AdventureLink | null>(null);
  const [saving, setSaving] = useState(false); const [message, setMessage] = useState<string | null>(null);
  const submit = async (event: FormEvent) => { event.preventDefault(); if (!label.trim() || !url.trim()) { setMessage("Enter both a label and URL."); return; } setSaving(true); setMessage(null); try { if (editing) await onEdit(editing.id, label, url); else await onAdd(label, url); setLabel(""); setUrl(""); setEditing(null); } catch (nextError) { setMessage(nextError instanceof Error ? nextError.message : "We could not save this link."); } finally { setSaving(false); } };
  return <div className="tab-panel links-live"><h2>Useful links</h2>
    {loading && <p className="inline-state" role="status">Loading links…</p>}
    {error && <div className="inline-error" role="alert"><span>{error}</span><button onClick={() => void onRetry()}>Retry</button></div>}
    {!loading && !error && !links.length && <div className="compact-empty"><ExternalLink /><p>No useful links saved yet.</p></div>}
    <div className="saved-links">{links.map((link) => <div className="saved-link" key={link.id}><a href={link.url} target="_blank" rel="noopener noreferrer"><ExternalLink /><span><b>{link.label}</b><small>{link.url}</small></span></a><div className="item-actions"><button onClick={() => { setEditing(link); setLabel(link.label); setUrl(link.url); }} aria-label={`Edit ${link.label}`}><Pencil /></button><button onClick={() => { if (window.confirm(`Delete “${link.label}”?`)) void onDelete(link.id); }} aria-label={`Delete ${link.label}`}><Trash2 /></button></div></div>)}</div>
    <form className="child-form" onSubmit={submit}><label><span>Label</span><input value={label} onChange={(event) => setLabel(event.target.value)} disabled={saving} /></label><label><span>URL</span><input inputMode="url" value={url} onChange={(event) => setUrl(event.target.value)} placeholder="https://example.com" disabled={saving} /></label><button className="primary" disabled={saving}>{saving ? "Saving…" : editing ? "Save link" : "Add link"}</button>{editing && <button type="button" className="secondary" onClick={() => { setEditing(null); setLabel(""); setUrl(""); }}>Cancel</button>}</form>
    {message && <p className="form-error" role="alert">{message}</p>}
  </div>;
}

type AdventureMenuAction = "edit" | "cover" | "duplicate" | "delete";

function AdventureActionsMenu({
  disabled,
  onAction,
}: {
  disabled: boolean;
  onAction: (action: AdventureMenuAction) => void;
}) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const frame = requestAnimationFrame(() =>
      menuRef.current?.querySelector<HTMLButtonElement>('[role="menuitem"]')?.focus(),
    );
    const onPointerDown = (event: PointerEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) setOpen(false);
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      setOpen(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  const choose = (action: AdventureMenuAction) => {
    setOpen(false);
    onAction(action);
  };
  const onMenuKeyDown = (event: React.KeyboardEvent<HTMLDivElement>) => {
    if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
    event.preventDefault();
    const items = Array.from(
      menuRef.current?.querySelectorAll<HTMLButtonElement>(
        '[role="menuitem"]:not(:disabled)',
      ) ?? [],
    );
    if (!items.length) return;
    const current = items.indexOf(document.activeElement as HTMLButtonElement);
    const next =
      event.key === "Home"
        ? 0
        : event.key === "End"
          ? items.length - 1
          : event.key === "ArrowDown"
            ? (current + 1) % items.length
            : (current - 1 + items.length) % items.length;
    items[next].focus();
  };

  return (
    <div className="adventure-actions" ref={containerRef}>
      <button
        ref={triggerRef}
        className="more"
        aria-label="Adventure actions"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-controls="adventure-actions-menu"
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
      >
        <MoreHorizontal />
      </button>
      {open && (
        <div
          ref={menuRef}
          className="adventure-actions-menu"
          id="adventure-actions-menu"
          role="menu"
          aria-label="Adventure actions"
          onKeyDown={onMenuKeyDown}
        >
          <button role="menuitem" onClick={() => choose("edit")}>
            <Pencil /> Edit adventure
          </button>
          <button role="menuitem" onClick={() => choose("cover")}>
            <ImagePlus /> Change cover photo
          </button>
          <button role="menuitem" onClick={() => choose("duplicate")}>
            <Copy /> Duplicate adventure
          </button>
          <div className="adventure-actions-divider" role="separator" />
          <button
            className="destructive"
            role="menuitem"
            onClick={() => choose("delete")}
          >
            <Trash2 /> Delete adventure
          </button>
        </div>
      )}
    </div>
  );
}

export function CoverPhotoSheet({
  adventure,
  onClose,
  onSave,
}: {
  adventure: Pick<
    Adventure,
    "id" | "category" | "coverImage" | "coverVariant"
  >;
  onClose: () => void;
  onSave: (selection: AdventureCoverSelection) => Promise<void>;
}) {
  type CoverMode = "automatic" | "custom" | string;
  type CustomStatus = "idle" | "loading" | "valid" | "invalid";
  const currentCover = adventure.coverImage?.trim() || "";
  const currentVariant = adventure.coverVariant;
  const category = normalizeCategoryOrNull(adventure.category);
  const categoryCoverAssets = category ? CATEGORY_COVER_ASSETS[category] : [];
  const currentVariantCover = getCategoryCoverByVariant(
    adventure.category,
    currentVariant,
  );
  const currentLibraryCover = currentCover &&
      categoryCoverAssets.some(({ path }) => path === currentCover)
    ? currentCover
    : currentVariantCover;
  const initialMode: CoverMode = currentCover
    ? currentLibraryCover ?? "custom"
    : currentLibraryCover ?? "automatic";
  const automaticCover = getStableCategoryCover(
    adventure.category,
    adventure.id,
  );
  const [mode, setMode] = useState<CoverMode>(initialMode);
  const [coverImage, setCoverImage] = useState(
    initialMode === "custom" ? currentCover : "",
  );
  const [customStatus, setCustomStatus] = useState<CustomStatus>(
    initialMode === "custom"
      ? /^https?:\/\//i.test(currentCover) || currentCover.startsWith("/")
        ? "loading"
        : "invalid"
      : "idle",
  );
  const [lastValidPreview, setLastValidPreview] = useState(
    currentLibraryCover ?? automaticCover,
  );
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const trimmed = coverImage.trim();
  const isSupported =
    !trimmed || /^https?:\/\//i.test(trimmed) || trimmed.startsWith("/");
  const selectedLibraryCover = mode !== "automatic" && mode !== "custom"
    ? mode
    : undefined;
  const preview = mode === "custom" && isSupported && trimmed &&
      customStatus !== "invalid"
    ? trimmed
    : selectedLibraryCover ?? (mode === "custom"
      ? lastValidPreview
      : automaticCover);
  const isDirty = mode !== initialMode ||
    (mode === "custom" && trimmed !==
      (initialMode === "custom" ? currentCover : ""));
  const canSave = isDirty && !saving &&
    (mode !== "custom" || isSupported && customStatus === "valid");
  const variantOptions = categoryCoverAssets.map<CoverPickerOption<string>>(
    (asset) => ({
    value: asset.path,
    label: asset.label,
    source: asset.path,
    ariaLabel: `Use ${asset.label} cover`,
  }));

  useEffect(() => {
    if (mode !== "custom" || !trimmed || !isSupported) return;
    let active = true;
    const image = new Image();
    image.onload = () => {
      if (!active) return;
      setCustomStatus("valid");
      setLastValidPreview(trimmed);
      setError(null);
    };
    image.onerror = () => {
      if (!active) return;
      setCustomStatus("invalid");
      setError("We couldn’t load this image. Check the URL and try again.");
    };
    image.src = trimmed;
    return () => {
      active = false;
    };
  }, [isSupported, mode, trimmed]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!canSave) {
      if (mode === "custom" && !isSupported)
        setError("Enter an http(s) image URL or an app image path beginning with /.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSave(
        mode === "custom"
          ? { coverImage: trimmed }
          : mode === "automatic"
          ? {}
          : (() => {
            const originalIndex = categoryCoverAssets
              .slice(0, 3)
              .findIndex(({ path }) => path === mode);
            return originalIndex >= 0
              ? { coverVariant: (originalIndex + 1) as AdventureCoverVariant }
              : { coverImage: mode };
          })(),
      );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "We could not update the cover photo.",
      );
    } finally {
      setSaving(false);
    }
  };
  return (
    <CoverPickerSheet
      title="Change cover photo"
      previewSource={preview}
      previewAlt="Adventure cover preview"
      fallbackSource={GENERIC_ADVENTURE_COVER}
      sectionTitle="Category covers"
      sectionDescription="Choose a cover for this adventure, or keep the automatic rotation."
      automaticDescription="Uses a stable category cover for this adventure."
      automaticSelected={mode === "automatic"}
      options={variantOptions}
      choicesAriaLabel="Category cover choices"
      selectedValue={selectedLibraryCover}
      saving={saving}
      canSave={canSave}
      error={error}
      onSelectAutomatic={() => {
        setMode("automatic");
        setCoverImage("");
        setCustomStatus("idle");
        setError(null);
      }}
      onSelectOption={(path) => {
        setMode(path);
        setCoverImage("");
        setCustomStatus("idle");
        setError(null);
      }}
      onClose={onClose}
      onSubmit={(event) => void submit(event)}
    >
      <label className="cover-custom-url">
        Custom image URL
        <input
          type="url"
          value={coverImage}
          onChange={(event) => {
            const nextValue = event.target.value;
            const nextTrimmed = nextValue.trim();
            const nextSupported = /^https?:\/\//i.test(nextTrimmed) ||
              nextTrimmed.startsWith("/");
            setCoverImage(nextValue);
            setMode(nextTrimmed ? "custom" : "automatic");
            setCustomStatus(
              nextTrimmed ? nextSupported ? "loading" : "invalid" : "idle",
            );
            setError(null);
          }}
          placeholder="https://example.com/adventure.jpg"
          aria-invalid={mode === "custom" && customStatus === "invalid"}
        />
      </label>
      <small>
        Paste an http(s) image URL. A valid custom image overrides category covers.
      </small>
    </CoverPickerSheet>
  );
}

export function AdventureDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const {
    adventures,
    loading,
    error,
    retry,
    stopsLoading,
    stopsError,
    childDataLoading,
    childDataError,
    loadAdventureStops,
    loadAdventureChildren,
    toggleFavorite,
    saveNotes,
    addAdventureStop,
    updateAdventureStop,
    deleteAdventureStop,
    reorderAdventureStops,
    addChecklistItem,
    editChecklistItem,
    toggleChecklistItem,
    deleteChecklistItem,
    reorderChecklistItem,
    addAdventureLink,
    editAdventureLink,
    deleteAdventureLink,
    setAdventureCompleted,
    updateAdventure,
    updateAdventureCover,
    duplicateAdventure,
    deleteAdventure,
  } = useAdventureStore();
  const { activeSpace, memberships } = useWorkspace();
  const a = adventures.find((x) => x.id === id);
  const adventureId = a?.id;
  const [tab, setTab] = useState("Itinerary");
  const [notesDraft, setNotesDraft] = useState("");
  const [notesSaving, setNotesSaving] = useState(false);
  const [notesError, setNotesError] = useState<string | null>(null);
  const [stopEditor, setStopEditor] = useState<{
    mode: "add" | "edit";
    stop?: AdventureStop;
  } | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<AdventureStop | null>(
    null,
  );
  const [completionSaving, setCompletionSaving] = useState(false);
  const [completionError, setCompletionError] = useState<string | null>(null);
  const [editOpen, setEditOpen] = useState(false);
  const [coverOpen, setCoverOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [duplicating, setDuplicating] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [selectedStopId, setSelectedStopId] = useState<string | null>(null);
  const orderedStops = useMemo(
    () =>
      [...(a?.stops ?? [])].sort(
        (first, second) => first.sortOrder - second.sortOrder,
      ),
    [a?.stops],
  );
  const preparedStopMap = useMemo(
    () => prepareStopMap(orderedStops),
    [orderedStops],
  );
  const stopMapCameraTarget = useMemo(
    () => buildStopMapCameraTarget(preparedStopMap.markers),
    [preparedStopMap.markers],
  );
  useEffect(() => {
    if (!adventureId) return;
    void loadAdventureStops(adventureId);
    void loadAdventureChildren(adventureId);
  }, [adventureId, loadAdventureChildren, loadAdventureStops]);
  if (loading)
    return (
      <div className="page">
        <div className="ideas-state" role="status">
          <span className="access-spinner" aria-hidden="true" />
          <h3>Opening this Adventure…</h3>
        </div>
      </div>
    );
  if (error)
    return (
      <div className="page">
        <div className="ideas-state ideas-error" role="alert">
          <h3>Adventure could not be loaded</h3>
          <p>{error}</p>
          <button onClick={() => void retry()}>Try again</button>
        </div>
      </div>
    );
  if (!a)
    return (
      <div className="page">
        <p>Adventure not found.</p>
      </div>
    );
  const activeSelectedStopId = reconcileSelectedStopId(
    selectedStopId,
    preparedStopMap.markers,
  );
  const mapMarkersByStopId = new Map(
    preparedStopMap.markers.map((marker) => [marker.stopId, marker]),
  );
  const canMutate = memberships.some(
    (membership) => membership.spaceId === activeSpace?.id,
  );
  const handleAdventureAction = (action: AdventureMenuAction) => {
    setActionError(null);
    if (action === "edit") setEditOpen(true);
    if (action === "cover") setCoverOpen(true);
    if (action === "delete") {
      setDeleteError(null);
      setDeleteOpen(true);
    }
    if (action === "duplicate") {
      setDuplicating(true);
      void duplicateAdventure(a.id)
        .then((duplicate) => nav(`/adventures/${duplicate.id}`))
        .catch((nextError) =>
          setActionError(
            nextError instanceof Error
              ? nextError.message
              : "We could not duplicate this adventure.",
          ),
        )
        .finally(() => setDuplicating(false));
    }
  };
  return (
    <div className="detail">
      <div className="detail-cover">
        <SafeImage
          src={resolveAdventureCover(a)}
          fallbackSrc={GENERIC_ADVENTURE_COVER}
          alt=""
          width={1600}
          height={800}
        />
        <button className="back" onClick={() => nav(-1)} aria-label="Go back">
          <ChevronLeft />
        </button>
        {canMutate && (
          <AdventureActionsMenu
            disabled={duplicating || deleting}
            onAction={handleAdventureAction}
          />
        )}
      </div>
      <section className="detail-sheet">
        <button
          className={`favorite ${a.favorite ? "on" : ""}`}
          onClick={() => void toggleFavorite(a.id)}
          aria-label="Toggle favorite"
        >
          <Heart fill={a.favorite ? "currentColor" : "none"} />
        </button>
        <h1>{a.title}</h1>
        {a.completed && <span className="completed-badge"><Check /> Completed</span>}
        {duplicating && <p className="action-feedback" role="status">Duplicating adventure…</p>}
        {actionError && <p className="form-error action-feedback" role="alert">{actionError}</p>}
        <p className="detail-date">
          {formatAdventureDateTimeRange({
            startDate: a.date,
            startTime: a.startTime,
            endDate: a.endDate,
            endTime: a.endTime,
          })}
        </p>
        <div className="detail-meta">
          <span className="detail-location"><MapPin /> {a.location}</span>
          <WeatherIndicator
            key={a.id}
            adventure={a}
            canEdit={canMutate}
            onEdit={() => setEditOpen(true)}
          />
        </div>
        {a.locationWeatherWarning && (
          <p className="location-weather-warning" role="status">
            {a.locationWeatherWarning}
          </p>
        )}
        <nav className="tabs">
          {["Itinerary", "Notes", "Links", "Checklist"].map((t) => (
            <button
              className={tab === t ? "active" : ""}
              onClick={() => {
                if (t === "Notes") setNotesDraft(a.notes);
                setTab(t);
              }}
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
            {stopsLoading && (
              <p className="inline-state" role="status">
                Loading itinerary…
              </p>
            )}
            {stopsError && (
              <p className="form-error" role="alert">
                {stopsError}
              </p>
            )}
            {orderedStops.length > 0 && (
              <AdventureStopsMapCard
                preparedMap={preparedStopMap}
                cameraTarget={stopMapCameraTarget}
                mapKey={import.meta.env.VITE_GEOAPIFY_MAP_KEY?.trim() ?? ""}
                selectedStopId={activeSelectedStopId}
                onSelectStop={setSelectedStopId}
              />
            )}
            {orderedStops.length ? (
              <div className="stops">
                {orderedStops.map((stop, index) => {
                  const mapMarker = mapMarkersByStopId.get(stop.id);
                  const selected = activeSelectedStopId === stop.id;
                  return (
                    <article
                    key={stop.id}
                    className={selected ? "selected-map-stop" : undefined}
                    data-map-selected={selected || undefined}
                  >
                    <ItineraryStopMarker
                      className="stop-num"
                      displayIndex={index}
                      isActualFinalStop={index === orderedStops.length - 1}
                      stopTitle={stop.title}
                      selected={selected}
                      onActivate={
                        mapMarker
                          ? () => setSelectedStopId(stop.id)
                          : undefined
                      }
                    />
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
                  );
                })}
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
            <textarea
              aria-label="Adventure notes"
              value={notesDraft}
              onChange={(event) => setNotesDraft(event.target.value)}
            />
            {notesError && (
              <p className="form-error" role="alert">
                {notesError}
              </p>
            )}
            <button
              className="primary"
              disabled={notesSaving}
              onClick={async () => {
                setNotesSaving(true);
                setNotesError(null);
                try {
                  await saveNotes(a.id, notesDraft);
                } catch (error) {
                  setNotesError(
                    error instanceof Error
                      ? error.message
                      : "We could not save these notes.",
                  );
                } finally {
                  setNotesSaving(false);
                }
              }}
            >
              {notesSaving ? "Saving…" : "Save notes"}
            </button>
          </div>
        )}
        {tab === "Links" && (
          <LinksPanel links={a.links} loading={childDataLoading} error={childDataError}
            onRetry={() => loadAdventureChildren(a.id)}
            onAdd={(label, url) => addAdventureLink(a.id, label, url)}
            onEdit={(linkId, label, url) => editAdventureLink(a.id, linkId, label, url)}
            onDelete={(linkId) => deleteAdventureLink(a.id, linkId)} />
        )}
        {tab === "Checklist" && (
          <ChecklistPanel items={a.checklist} loading={childDataLoading} error={childDataError}
            onRetry={() => loadAdventureChildren(a.id)} onAdd={(label) => addChecklistItem(a.id, label)}
            onEdit={(itemId, label) => editChecklistItem(a.id, itemId, label)}
            onToggle={(itemId) => toggleChecklistItem(a.id, itemId)}
            onDelete={(itemId) => deleteChecklistItem(a.id, itemId)}
            onReorder={(itemId, direction) => reorderChecklistItem(a.id, itemId, direction)} />
        )}
        {stopEditor && (
          <StopEditorSheet
            key={stopEditor.stop?.id || "new-stop"}
            adventureId={a.id}
            stop={stopEditor.stop}
            onClose={() => setStopEditor(null)}
            onSave={async (stop) => {
              if (stopEditor.mode === "edit" && stopEditor.stop)
                await updateAdventureStop(a.id, stopEditor.stop.id, stop);
              else await addAdventureStop(a.id, stop);
              if (stopEditor.mode === "edit" && stopEditor.stop)
                setSelectedStopId((current) =>
                  current === stopEditor.stop?.id ? null : current,
                );
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
                  onClick={async () => {
                    await deleteAdventureStop(a.id, deleteCandidate.id);
                    setSelectedStopId((current) =>
                      current === deleteCandidate.id ? null : current,
                    );
                    setDeleteCandidate(null);
                  }}
                >
                  Delete stop
                </button>
              </div>
            </div>
          </Sheet>
        )}
        {editOpen && (
          <AdventureFormSheet
            title="Edit adventure"
            adventureId={a.id}
            savedLocation={a.savedLocation}
            initialPlan={{
              title: a.title,
              description: a.description,
              date: a.date,
              endDate: a.endDate ?? (a.endTime ? a.date : ""),
              startTime: timeToInput(a.startTime),
              endTime: timeToInput(a.endTime),
              status: a.status === "Tentative" ? "Tentative" : "Confirmed",
              location: a.location === "Location to be decided" ? "" : a.location,
              notes: a.notes,
              category: a.category,
              coverImage: a.coverImage,
              coverVariant: a.coverVariant,
            }}
            submitLabel="Save changes"
            savingLabel="Saving…"
            onClose={() => setEditOpen(false)}
            onSubmit={async (plan) => {
              await updateAdventure(a.id, plan);
              setEditOpen(false);
            }}
          />
        )}
        {coverOpen && (
          <CoverPhotoSheet
            adventure={a}
            onClose={() => setCoverOpen(false)}
            onSave={async (selection) => {
              await updateAdventureCover(a.id, selection);
              setCoverOpen(false);
            }}
          />
        )}
        {deleteOpen && (
          <Sheet
            open
            title="Delete adventure?"
            onClose={() => {
              if (!deleting) setDeleteOpen(false);
            }}
          >
            <div className="delete-adventure-confirmation">
              <p>
                <strong>“{a.title}”</strong> will be permanently deleted. This cannot be undone.
              </p>
              <p>The following related content will also be deleted:</p>
              <ul>
                <li>{a.stops.length} itinerary {a.stops.length === 1 ? "stop" : "stops"}</li>
                <li>Adventure notes</li>
                <li>{a.links.length} saved {a.links.length === 1 ? "link" : "links"}</li>
                <li>{a.checklist.length} checklist {a.checklist.length === 1 ? "item" : "items"}</li>
              </ul>
              {deleteError && <p className="form-error" role="alert">{deleteError}</p>}
              <div className="sheet-actions">
                <button
                  className="secondary"
                  type="button"
                  disabled={deleting}
                  onClick={() => setDeleteOpen(false)}
                >
                  Cancel
                </button>
                <button
                  className="danger-button"
                  type="button"
                  disabled={deleting}
                  onClick={async () => {
                    if (deleting) return;
                    setDeleting(true);
                    setDeleteError(null);
                    try {
                      await deleteAdventure(a.id);
                      nav("/calendar");
                    } catch (nextError) {
                      setDeleteError(
                        nextError instanceof Error
                          ? nextError.message
                          : "We could not delete this adventure.",
                      );
                      setDeleting(false);
                    }
                  }}
                >
                  {deleting ? "Deleting…" : "Delete adventure"}
                </button>
              </div>
            </div>
          </Sheet>
        )}
        <button
          className={`complete-button ${a.completed ? "done" : ""}`}
          disabled={completionSaving || (!a.completed && !isAdventureMemoryEligible(a))}
          onClick={async () => {
            setCompletionSaving(true); setCompletionError(null);
            try { await setAdventureCompleted(a.id, !a.completed); }
            catch (nextError) { setCompletionError(nextError instanceof Error ? nextError.message : "We could not update completion."); }
            finally { setCompletionSaving(false); }
          }}
        >
          {completionSaving ? "Saving…" : a.completed ? (
            <>
              <Check /> Restore to upcoming
            </>
          ) : (
            <>
              Mark Adventure completed <Sparkles />
            </>
          )}
        </button>
        {!a.completed && !isAdventureMemoryEligible(a) && (
          <p className="action-feedback" role="status">This Adventure can become a memory after its final day.</p>
        )}
        {completionError && <p className="form-error" role="alert">{completionError}</p>}
      </section>
    </div>
  );
}
export function Memories() {
  const nav = useNavigate();
  const { adventures, loading, error, retry } = useAdventureStore();
  const done = useMemo(() => [...adventures]
    .filter((adventure) => adventure.completed && isAdventureMemoryEligible(adventure))
    .sort((first, second) =>
      (second.completedAt || second.date).localeCompare(first.completedAt || first.date),
    ), [adventures]);
  const [summaries, setSummaries] = useState<Record<string, MemorySummary>>({});
  const adventureIds = done.map((adventure) => adventure.id).join(",");
  useEffect(() => {
    let active = true;
    if (!adventureIds) {
      return () => { active = false; };
    }
    void loadMemorySummaries(adventureIds.split(","))
      .then((next) => { if (active) setSummaries(next); })
      .catch(() => { if (active) setSummaries({}); });
    return () => { active = false; };
  }, [adventureIds]);
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
      {loading && <p className="inline-state" role="status">Gathering your memories…</p>}
      {error && <div className="ideas-state ideas-error" role="alert"><p>{error}</p><button onClick={() => void retry()}>Try again</button></div>}
      <div className="memory-grid">
        {!loading && !error && done.length ? (
          done.map((a) => (
            <button className="memory-card" key={a.id} onClick={() => nav(`/memories/${a.id}`)}>
              <div className="memory-art-cover">
                <SafeImage
                  src={resolveMemoryCover({
                    adventure: a,
                    firstPhotoUrl: summaries[a.id]?.coverUrl,
                  })}
                  fallbackSrc={GENERIC_ADVENTURE_COVER}
                  alt=""
                  loading="lazy"
                  width={1600}
                  height={800}
                />
              </div>
              <small>{formatAdventureDateTimeRange({ startDate: a.date, startTime: a.startTime, endDate: a.endDate, endTime: a.endTime })}</small>
              <h3>{a.title}</h3>
              <p>{summaries[a.id]?.reflection || a.notes || a.description || a.location}</p>
              <span>{a.location}{summaries[a.id]?.photoCount ? ` · ${summaries[a.id].photoCount} ${summaries[a.id].photoCount === 1 ? "photo" : "photos"}` : " · Add photos"}</span>
            </button>
          ))
        ) : !loading && !error ? (
          <div className="empty-memory">
            <Heart />
            <h3>Your first memory is waiting</h3>
            <p>Complete an adventure and it will appear here.</p>
          </div>
        ) : null}
      </div>
    </div>
  );
}
