import {
  useEffect,
  useId,
  useRef,
  useState,
  type FocusEvent,
  type KeyboardEvent,
} from "react";
import { Check, MapPin, Search, X } from "lucide-react";
import {
  editLocationDraft,
  selectLocationDraft,
  shouldShowTextOnlyWarning,
} from "./location-field-state";
import { searchLocationCandidates } from "./repositories/location-search";
import type { LocationCandidate, LocationDraft, SavedLocation } from "./types";

type SearchLocations = typeof searchLocationCandidates;

export type LocationSearchFieldProps = {
  id?: string;
  label?: string;
  spaceId: string;
  adventureId?: string;
  savedLocation: SavedLocation;
  draft: LocationDraft;
  onChange: (draft: LocationDraft) => void;
  textOnlyWarning: string;
  searchLocations?: SearchLocations;
};

type SearchState = "idle" | "loading" | "results" | "empty" | "error";

function isAbortError(error: unknown) {
  return error instanceof DOMException
    ? error.name === "AbortError"
    : error instanceof Error && error.name === "AbortError";
}

function primaryCandidateName(candidate: LocationCandidate) {
  return candidate.address.name || candidate.label;
}

export function LocationSearchField({
  id,
  label = "Location",
  spaceId,
  adventureId,
  savedLocation,
  draft,
  onChange,
  textOnlyWarning,
  searchLocations = searchLocationCandidates,
}: LocationSearchFieldProps) {
  const generatedId = useId();
  const inputId = id ?? `location-${generatedId}`;
  const listboxId = `${inputId}-results`;
  const helpId = `${inputId}-help`;
  const warningId = `${inputId}-warning`;
  const fieldRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const requestSequence = useRef(0);
  const [searchEnabled, setSearchEnabled] = useState(false);
  const [state, setState] = useState<SearchState>("idle");
  const [candidates, setCandidates] = useState<LocationCandidate[]>([]);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const [retryCount, setRetryCount] = useState(0);
  const query = draft.label.trim();

  useEffect(() => {
    if (!searchEnabled || query.length < 3 || !spaceId) {
      return;
    }

    const controller = new AbortController();
    const sequence = ++requestSequence.current;
    const timer = window.setTimeout(() => {
      setState("loading");
      setOpen(true);
      setActiveIndex(-1);
      void searchLocations(
        {
          spaceId,
          query,
          ...(adventureId ? { adventureId } : {}),
        },
        { signal: controller.signal },
      )
        .then((results) => {
          if (controller.signal.aborted || sequence !== requestSequence.current)
            return;
          setCandidates(results);
          setState(results.length ? "results" : "empty");
          setOpen(true);
          setActiveIndex(results.length ? 0 : -1);
        })
        .catch((error: unknown) => {
          if (
            controller.signal.aborted ||
            sequence !== requestSequence.current ||
            isAbortError(error)
          )
            return;
          setCandidates([]);
          setState("error");
          setOpen(true);
          setActiveIndex(-1);
        });
    }, 300);

    return () => {
      window.clearTimeout(timer);
      controller.abort();
    };
  }, [adventureId, query, retryCount, searchEnabled, searchLocations, spaceId]);

  const focusInput = () => {
    window.requestAnimationFrame(() => inputRef.current?.focus());
  };

  const selectCandidate = (candidate: LocationCandidate) => {
    onChange(selectLocationDraft(candidate));
    setSearchEnabled(false);
    setCandidates([]);
    setState("idle");
    setOpen(false);
    setActiveIndex(-1);
    focusInput();
  };

  const replaceLocation = () => {
    onChange(editLocationDraft(draft.label));
    setSearchEnabled(true);
    focusInput();
  };

  const removeLocation = () => {
    onChange(editLocationDraft(""));
    setSearchEnabled(false);
    setCandidates([]);
    setState("idle");
    setOpen(false);
    setActiveIndex(-1);
    focusInput();
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape" && open) {
      event.preventDefault();
      event.stopPropagation();
      setOpen(false);
      setActiveIndex(-1);
      return;
    }
    if (!open || state !== "results" || candidates.length === 0) return;
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => (current + 1) % candidates.length);
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) =>
        current <= 0 ? candidates.length - 1 : current - 1,
      );
    } else if (event.key === "Enter" && activeIndex >= 0) {
      event.preventDefault();
      selectCandidate(candidates[activeIndex]);
    }
  };

  const closeOnFocusLeave = (event: FocusEvent<HTMLDivElement>) => {
    if (!fieldRef.current?.contains(event.relatedTarget as Node | null)) {
      setOpen(false);
      setActiveIndex(-1);
    }
  };

  const preservedConfirmed =
    draft.intent === "preserve" && savedLocation.kind === "confirmed"
      ? savedLocation
      : null;
  const preservedLegacy =
    draft.intent === "preserve" && savedLocation.kind === "legacy"
      ? savedLocation
      : null;
  const selectedCandidate =
    draft.intent === "selected" ? draft.candidate : undefined;
  const settled = Boolean(
    preservedConfirmed || preservedLegacy || selectedCandidate,
  );
  const formattedAddress =
    selectedCandidate?.formattedAddress ||
    preservedConfirmed?.candidate.formattedAddress ||
    preservedLegacy?.formattedAddress;
  const showWarning = shouldShowTextOnlyWarning(draft, savedLocation);
  const describedBy = [helpId, showWarning ? warningId : null]
    .filter(Boolean)
    .join(" ");
  const activeOptionId =
    open && activeIndex >= 0 ? `${listboxId}-option-${activeIndex}` : undefined;
  const liveMessage =
    state === "loading"
      ? "Searching for locations."
      : state === "empty"
        ? "No locations found. You can still save this location as text."
        : state === "error"
          ? "Location search is temporarily unavailable."
          : state === "results"
            ? `${candidates.length} location ${candidates.length === 1 ? "result" : "results"} available.`
            : "";

  return (
    <div
      className="location-search-field"
      ref={fieldRef}
      onBlur={closeOnFocusLeave}
    >
      <label htmlFor={inputId}>{label}</label>
      <div className="location-combobox-wrap">
        <Search aria-hidden="true" />
        <input
          ref={inputRef}
          id={inputId}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={open}
          aria-controls={listboxId}
          aria-activedescendant={activeOptionId}
          aria-describedby={describedBy}
          autoComplete="off"
          value={draft.label}
          onChange={(event) => {
            const nextLabel = event.target.value;
            onChange(editLocationDraft(nextLabel));
            setSearchEnabled(true);
            setOpen(false);
            setActiveIndex(-1);
            if (nextLabel.trim().length < 3) {
              setCandidates([]);
              setState("idle");
            }
          }}
          onFocus={() => {
            if (searchEnabled && query.length >= 3 && state !== "idle")
              setOpen(true);
          }}
          onKeyDown={onKeyDown}
        />
      </div>
      <span className="location-field-help" id={helpId}>
        Type at least 3 characters, then select a result to confirm it.
      </span>

      {settled && (
        <div className="location-settled-state">
          <div>
            {selectedCandidate || preservedConfirmed ? (
              <span className="location-status confirmed-location">
                <Check aria-hidden="true" /> Confirmed location
              </span>
            ) : (
              <span className="location-status legacy-location">
                <MapPin aria-hidden="true" /> Existing weather location
              </span>
            )}
            {formattedAddress && <small>{formattedAddress}</small>}
          </div>
          <div className="location-actions">
            <button type="button" onClick={replaceLocation}>
              Replace
            </button>
            <button type="button" onClick={removeLocation}>
              <X aria-hidden="true" /> Remove
            </button>
          </div>
        </div>
      )}

      {open && (
        <div className="location-results-popover">
          {state === "loading" && (
            <div className="location-search-state">
              <span className="access-spinner" aria-hidden="true" />
              Searching locations…
            </div>
          )}
          {state === "empty" && (
            <div className="location-search-state">
              No matching locations. You can save this as text only.
            </div>
          )}
          {state === "error" && (
            <div className="location-search-state location-search-error">
              <span>Location search is temporarily unavailable.</span>
              <button
                type="button"
                onClick={() => setRetryCount((current) => current + 1)}
              >
                Try again
              </button>
            </div>
          )}
          {state === "results" && (
            <ul id={listboxId} role="listbox" aria-label="Location results">
              {candidates.map((candidate, index) => (
                <li
                  id={`${listboxId}-option-${index}`}
                  key={`${candidate.provider}:${candidate.providerPlaceId}`}
                  role="option"
                  aria-selected={index === activeIndex}
                  onMouseDown={(event) => event.preventDefault()}
                  onMouseEnter={() => setActiveIndex(index)}
                  onClick={() => selectCandidate(candidate)}
                >
                  <strong>{primaryCandidateName(candidate)}</strong>
                  <span>{candidate.formattedAddress}</span>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}

      {showWarning && (
        <p className="location-text-warning" id={warningId} role="status">
          {textOnlyWarning}
        </p>
      )}
      <span className="sr-only" aria-live="polite" aria-atomic="true">
        {liveMessage}
      </span>
    </div>
  );
}
