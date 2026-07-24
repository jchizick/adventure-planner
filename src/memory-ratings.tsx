import { Pencil, Star, Trash2 } from "lucide-react";
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
} from "react";
import {
  formatRatingAverage,
  formatRatingCount,
  formatWouldDoAgainSummary,
  MAX_ADVENTURE_RATING_NOTE_LENGTH,
  orderAdventureRatings,
  summarizeAdventureRatings,
} from "./rating-model";
import {
  deleteCurrentUserRating,
  listAdventureRatings,
  saveCurrentUserRating,
  subscribeToAdventureRatings,
  unsubscribeFromAdventureRatings,
} from "./repositories/ratings";
import type {
  AdventureRatingScore,
  AdventureRatingWithMember,
} from "./types";

const SCORES = [1, 2, 3, 4, 5] as const;

function RatingStars({ rating }: { rating: AdventureRatingScore }) {
  return (
    <span className="memory-rating-stars" aria-label={`${rating} ${rating === 1 ? "star" : "stars"}`}>
      {SCORES.map((score) => (
        <Star
          key={score}
          aria-hidden="true"
          className={score <= rating ? "filled" : ""}
          fill={score <= rating ? "currentColor" : "none"}
        />
      ))}
    </span>
  );
}

export function MemoryRatings({
  adventureId,
  currentUserId,
}: {
  adventureId: string;
  currentUserId: string;
}) {
  const [ratings, setRatings] = useState<AdventureRatingWithMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(true);
  const [score, setScore] = useState<AdventureRatingScore | null>(null);
  const [wouldDoAgain, setWouldDoAgain] = useState<boolean | null>(null);
  const [note, setNote] = useState("");
  const [validationError, setValidationError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [confirmingRemove, setConfirmingRemove] = useState(false);
  const [removeError, setRemoveError] = useState<string | null>(null);
  const [removing, setRemoving] = useState(false);
  const requestIdRef = useRef(0);
  const formDirtyRef = useRef(false);
  const editButtonRef = useRef<HTMLButtonElement>(null);
  const firstStarRef = useRef<HTMLInputElement>(null);

  const currentRating = ratings.find((rating) => rating.userId === currentUserId);
  const orderedRatings = useMemo(
    () => orderAdventureRatings(ratings, currentUserId),
    [currentUserId, ratings],
  );
  const summary = useMemo(() => summarizeAdventureRatings(ratings), [ratings]);
  const wouldSummary = formatWouldDoAgainSummary(summary);

  const resetDraft = useCallback((rating?: AdventureRatingWithMember) => {
    setScore(rating?.rating ?? null);
    setWouldDoAgain(rating?.wouldDoAgain ?? null);
    setNote(rating?.note ?? "");
    setValidationError(null);
    setSaveError(null);
    formDirtyRef.current = false;
  }, []);

  const refresh = useCallback(async (showLoading = false) => {
    const requestId = ++requestIdRef.current;
    if (showLoading) setLoading(true);
    setLoadError(null);
    try {
      const next = await listAdventureRatings(adventureId);
      if (requestId !== requestIdRef.current) return;
      setRatings(next);
      const nextCurrent = next.find((rating) => rating.userId === currentUserId);
      if (!formDirtyRef.current) {
        resetDraft(nextCurrent);
        setEditing(!nextCurrent);
      }
    } catch (error) {
      if (requestId !== requestIdRef.current) return;
      setLoadError(error instanceof Error ? error.message : "We could not load ratings.");
    } finally {
      if (requestId === requestIdRef.current) setLoading(false);
    }
  }, [adventureId, currentUserId, resetDraft]);

  useEffect(() => {
    formDirtyRef.current = false;
    const frame = window.requestAnimationFrame(() => void refresh(true));
    const channel = subscribeToAdventureRatings(adventureId, () => {
      void refresh();
    });
    return () => {
      window.cancelAnimationFrame(frame);
      requestIdRef.current += 1;
      void unsubscribeFromAdventureRatings(channel);
    };
  }, [adventureId, refresh, resetDraft]);

  const markDirty = () => {
    formDirtyRef.current = true;
    setValidationError(null);
    setSaveError(null);
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (saving || removing) return;
    if (!score) {
      setValidationError("Choose a star rating before saving.");
      firstStarRef.current?.focus();
      return;
    }
    const trimmedNote = note.trim();
    if (trimmedNote.length > MAX_ADVENTURE_RATING_NOTE_LENGTH) {
      setValidationError(`Keep your note to ${MAX_ADVENTURE_RATING_NOTE_LENGTH} characters.`);
      return;
    }
    setSaving(true);
    setValidationError(null);
    setSaveError(null);
    try {
      const next = await saveCurrentUserRating({
        adventureId,
        rating: score,
        wouldDoAgain,
        note: trimmedNote || null,
      });
      setRatings(next);
      const nextCurrent = next.find((rating) => rating.userId === currentUserId);
      resetDraft(nextCurrent);
      setEditing(false);
      window.requestAnimationFrame(() => editButtonRef.current?.focus());
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "We could not save this rating.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!currentRating || removing || saving) return;
    setRemoving(true);
    setRemoveError(null);
    try {
      await deleteCurrentUserRating(currentRating.id);
      setRatings((current) => current.filter((rating) => rating.id !== currentRating.id));
      setConfirmingRemove(false);
      setEditing(true);
      resetDraft();
      window.requestAnimationFrame(() => firstStarRef.current?.focus());
    } catch (error) {
      setRemoveError(error instanceof Error ? error.message : "We could not remove this rating.");
    } finally {
      setRemoving(false);
    }
  };

  return (
    <section className="memory-ratings-card" aria-labelledby="memory-ratings-heading">
      <div className="memory-section-heading">
        <div>
          <small>Personal takes, shared together</small>
          <h2 id="memory-ratings-heading">Ratings</h2>
        </div>
      </div>

      {loading ? (
        <p className="inline-state" role="status">Gathering ratings…</p>
      ) : loadError ? (
        <div className="memory-inline-error" role="alert">
          <p>{loadError}</p>
          <button onClick={() => void refresh(true)}>Try again</button>
        </div>
      ) : (
        <>
          <div className={`memory-rating-summary ${summary.count ? "" : "empty"}`} aria-live="polite">
            {summary.average === null ? (
              <div><strong>No ratings yet</strong><span>Be the first to rate this adventure.</span></div>
            ) : (
              <div>
                <strong><Star aria-hidden="true" fill="currentColor" /> {formatRatingAverage(summary.average)}</strong>
                <span>{formatRatingCount(summary.count)}</span>
                {wouldSummary ? <small>{wouldSummary}</small> : null}
              </div>
            )}
          </div>

          {editing ? (
            <form className="memory-rating-form" onSubmit={(event) => void submit(event)}>
              <div>
                <h3>{currentRating ? "Edit your rating" : "Rate this adventure"}</h3>
                <p>Your rating is separate from the shared Memory reflection.</p>
              </div>
              <fieldset className="memory-star-fieldset" aria-describedby={validationError ? "rating-validation-error" : undefined}>
                <legend>Star rating</legend>
                <div className="memory-star-selector">
                  {SCORES.map((value, index) => (
                    <label className={score !== null && value <= score ? "scored" : ""} key={value}>
                      <input
                        ref={index === 0 ? firstStarRef : undefined}
                        className="sr-only"
                        type="radio"
                        name="adventure-rating"
                        value={value}
                        checked={score === value}
                        onChange={() => {
                          setScore(value);
                          markDirty();
                        }}
                      />
                      <Star aria-hidden="true" fill={score !== null && value <= score ? "currentColor" : "none"} />
                      <span className="sr-only">{value} {value === 1 ? "star" : "stars"}</span>
                    </label>
                  ))}
                </div>
              </fieldset>

              <fieldset className="memory-again-fieldset">
                <legend>Would you do it again?</legend>
                <div className="memory-again-control">
                  <label>
                    <input className="sr-only" type="radio" name="would-do-again" checked={wouldDoAgain === true} onChange={() => { setWouldDoAgain(true); markDirty(); }} />
                    Yes
                  </label>
                  <label>
                    <input className="sr-only" type="radio" name="would-do-again" checked={wouldDoAgain === false} onChange={() => { setWouldDoAgain(false); markDirty(); }} />
                    No
                  </label>
                  {wouldDoAgain !== null ? <button type="button" onClick={() => { setWouldDoAgain(null); markDirty(); }}>Clear</button> : null}
                </div>
              </fieldset>

              <div className="memory-rating-note">
                <label htmlFor="memory-personal-note">Personal note</label>
                <p id="memory-personal-note-help">Optional · Visible to members of this shared space.</p>
                <textarea
                  id="memory-personal-note"
                  rows={4}
                  maxLength={MAX_ADVENTURE_RATING_NOTE_LENGTH}
                  aria-describedby="memory-personal-note-help memory-personal-note-count"
                  value={note}
                  onChange={(event) => {
                    setNote(event.target.value);
                    markDirty();
                  }}
                />
                <span id="memory-personal-note-count">{note.length}/{MAX_ADVENTURE_RATING_NOTE_LENGTH}</span>
              </div>

              {validationError ? <p id="rating-validation-error" className="form-error" role="alert">{validationError}</p> : null}
              {saveError ? <p className="form-error" role="alert">{saveError}</p> : null}
              <div className="memory-rating-form-actions">
                {currentRating ? <button type="button" className="button-secondary" disabled={saving} onClick={() => { resetDraft(currentRating); setEditing(false); }}>Cancel</button> : null}
                <button className="button-primary" type="submit" disabled={saving || removing}>
                  {saving ? "Saving…" : "Save rating"}
                </button>
              </div>
            </form>
          ) : null}

          {orderedRatings.length ? (
            <div className="memory-rating-list">
              {orderedRatings.map((item) => {
                const isCurrent = item.userId === currentUserId;
                return (
                  <article className="memory-rating-item" key={item.id}>
                    <span className="person-avatar" aria-hidden="true">{item.memberName.slice(0, 1).toUpperCase()}</span>
                    <div className="memory-rating-item-content">
                      <div className="memory-rating-item-heading">
                        <strong>{item.memberName}{isCurrent ? " · You" : ""}</strong>
                        {isCurrent && !editing ? (
                          <span>
                            <button ref={editButtonRef} onClick={() => { resetDraft(item); formDirtyRef.current = true; setConfirmingRemove(false); setEditing(true); }}><Pencil /> Edit</button>
                            <button onClick={() => { setConfirmingRemove(true); setRemoveError(null); }}><Trash2 /> Remove</button>
                          </span>
                        ) : null}
                      </div>
                      <RatingStars rating={item.rating} />
                      {item.wouldDoAgain !== null ? <p>{item.wouldDoAgain ? "Would do it again" : "Would not do it again"}</p> : null}
                      {item.note ? <blockquote>{item.note}</blockquote> : null}
                      {isCurrent && confirmingRemove ? (
                        <div className="memory-rating-remove" role="group" aria-label="Confirm rating removal">
                          <span>Remove your rating?</span>
                          <button className="button-secondary" disabled={removing} onClick={() => setConfirmingRemove(false)}>Keep it</button>
                          <button className="danger-button" disabled={removing} onClick={() => void remove()}>{removing ? "Removing…" : "Remove"}</button>
                          {removeError ? <p className="form-error" role="alert">{removeError}</p> : null}
                        </div>
                      ) : null}
                    </div>
                  </article>
                );
              })}
            </div>
          ) : null}
        </>
      )}
    </section>
  );
}
