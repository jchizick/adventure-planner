import {
  ArrowLeft,
  Camera,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Heart,
  ImagePlus,
  MapPin,
  Pencil,
  Trash2,
  X,
} from "lucide-react";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { useAuth } from "./auth";
import { formatAdventureDateTimeRange } from "./calendar";
import { useAdventureStore } from "./context";
import {
  deleteMemoryPhoto,
  loadAdventureMemory,
  MAX_MEMORY_PHOTO_BYTES,
  MEMORY_PHOTO_TYPES,
  saveMemoryReflection,
  uploadMemoryPhoto,
} from "./repositories/memories";
import type { AdventureMemory, MemoryPhoto } from "./types";
import { useWorkspace } from "./workspace";

type UploadItem = {
  id: string;
  name: string;
  status: "uploading" | "failed";
  message?: string;
};

const memoryDate = (value: string) =>
  new Intl.DateTimeFormat("en-CA", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
  }).format(new Date(`${value}T12:00:00`));

function Lightbox({
  photos,
  initialIndex,
  onClose,
}: {
  photos: MemoryPhoto[];
  initialIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(initialIndex);
  const dialogRef = useRef<HTMLDivElement>(null);
  const photo = photos[index];

  useEffect(() => {
    const previousFocus = document.activeElement as HTMLElement | null;
    dialogRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowLeft")
        setIndex((current) => (current - 1 + photos.length) % photos.length);
      if (event.key === "ArrowRight")
        setIndex((current) => (current + 1) % photos.length);
      if (event.key === "Tab" && dialogRef.current) {
        const controls = [...dialogRef.current.querySelectorAll<HTMLElement>("button")];
        if (!controls.length) return;
        const first = controls[0];
        const last = controls[controls.length - 1];
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      previousFocus?.focus();
    };
  }, [onClose, photos.length]);

  return (
    <div className="memory-lightbox" role="presentation" onMouseDown={(event) => {
      if (event.target === event.currentTarget) onClose();
    }}>
      <div
        className="memory-lightbox-dialog"
        role="dialog"
        aria-modal="true"
        aria-label={`Photo ${index + 1} of ${photos.length}`}
        ref={dialogRef}
        tabIndex={-1}
      >
        <button className="memory-lightbox-close" onClick={onClose} aria-label="Close photo viewer">
          <X />
        </button>
        {photos.length > 1 && (
          <button
            className="memory-lightbox-previous"
            onClick={() => setIndex((current) => (current - 1 + photos.length) % photos.length)}
            aria-label="Previous photo"
          >
            <ChevronLeft />
          </button>
        )}
        <figure>
          <img src={photo.url} alt={photo.caption || `Memory uploaded by ${photo.uploadedBy}`} />
          <figcaption>
            {photo.caption && <span>{photo.caption}</span>}
            <small>Added by {photo.uploadedBy}</small>
          </figcaption>
        </figure>
        {photos.length > 1 && (
          <button
            className="memory-lightbox-next"
            onClick={() => setIndex((current) => (current + 1) % photos.length)}
            aria-label="Next photo"
          >
            <ChevronRight />
          </button>
        )}
      </div>
    </div>
  );
}

export function MemoryDetail() {
  const { adventureId } = useParams();
  const nav = useNavigate();
  const { user } = useAuth();
  const { activeSpace, memberships } = useWorkspace();
  const { adventures, loading: adventuresLoading, error: adventuresError, retry } = useAdventureStore();
  const adventure = adventures.find((item) => item.id === adventureId);
  const [memory, setMemory] = useState<AdventureMemory | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [reflection, setReflection] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [uploads, setUploads] = useState<UploadItem[]>([]);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);
  const [deleteCandidate, setDeleteCandidate] = useState<MemoryPhoto | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);
  const [deleting, setDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const isOwner = memberships.some(
    (membership) => membership.spaceId === activeSpace?.id && membership.role === "owner",
  );

  const reloadMemory = async () => {
    if (!adventureId || !adventure?.completed) return;
    setLoading(true);
    setLoadError(null);
    try {
      const next = await loadAdventureMemory(adventureId);
      setMemory(next);
      setReflection(next.reflection);
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : "We could not load this memory.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void reloadMemory();
    // reload only when the route or completion state changes
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [adventureId, adventure?.completed]);

  useEffect(() => {
    if (!editing) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        setReflection(memory?.reflection ?? "");
        setEditing(false);
        setSaveError(null);
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [editing, memory?.reflection]);

  const heroImage = memory?.photos[0]?.url || adventure?.coverImage;
  const timeLabel = useMemo(
    () => adventure ? formatAdventureDateTimeRange({
      startDate: adventure.date,
      startTime: adventure.startTime,
      endDate: adventure.date,
      endTime: adventure.endTime,
    }) : "",
    [adventure],
  );

  if (adventuresLoading)
    return <div className="memory-route-state" role="status">Opening this memory…</div>;
  if (adventuresError)
    return <div className="memory-route-state" role="alert"><p>{adventuresError}</p><button onClick={() => void retry()}>Try again</button></div>;
  if (!adventure)
    return <div className="memory-route-state"><h1>Memory not found</h1><p>This adventure may have been removed.</p><Link to="/memories">Back to Memories</Link></div>;
  if (!adventure.completed)
    return <div className="memory-route-state"><Camera /><h1>A memory in the making</h1><p>Memories become available after an adventure is completed.</p><Link to={`/adventures/${adventure.id}`}>View adventure details</Link></div>;

  const saveReflection = async () => {
    if (!user) return;
    setSaving(true);
    setSaveError(null);
    try {
      const saved = await saveMemoryReflection(adventure.id, user.id, reflection.trim());
      setMemory((current) => current ? { ...current, ...saved } : current);
      setReflection(saved.reflection);
      setEditing(false);
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "We could not save this reflection.");
    } finally {
      setSaving(false);
    }
  };

  const uploadFiles = async (event: ChangeEvent<HTMLInputElement>) => {
    const files = [...(event.target.files ?? [])];
    event.target.value = "";
    if (!user || !activeSpace || !files.length) return;
    for (const file of files) {
      const uploadId = crypto.randomUUID();
      const validType = MEMORY_PHOTO_TYPES.includes(file.type as (typeof MEMORY_PHOTO_TYPES)[number]);
      const validationMessage = !validType
        ? "Choose a JPEG, PNG, or WebP image."
        : file.size > MAX_MEMORY_PHOTO_BYTES
          ? "This photo is larger than 10 MB."
          : null;
      setUploads((current) => [...current, { id: uploadId, name: file.name, status: validationMessage ? "failed" : "uploading", message: validationMessage ?? undefined }]);
      if (validationMessage) continue;
      try {
        const photo = await uploadMemoryPhoto({ adventureId: adventure.id, spaceId: activeSpace.id, userId: user.id, file });
        setMemory((current) => current ? { ...current, photos: [...current.photos, photo] } : current);
        setUploads((current) => current.filter((item) => item.id !== uploadId));
      } catch (error) {
        setUploads((current) => current.map((item) => item.id === uploadId ? {
          ...item,
          status: "failed",
          message: error instanceof Error ? error.message : "Upload failed. Try again.",
        } : item));
      }
    }
  };

  const confirmDelete = async () => {
    if (!deleteCandidate) return;
    setDeleting(true);
    setDeleteError(null);
    try {
      await deleteMemoryPhoto(deleteCandidate);
      setMemory((current) => current ? {
        ...current,
        photos: current.photos.filter((photo) => photo.id !== deleteCandidate.id),
      } : current);
      setDeleteCandidate(null);
    } catch (error) {
      setDeleteError(error instanceof Error ? error.message : "We could not delete this photo.");
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="memory-detail-page">
      <section className={`memory-hero ${heroImage ? "has-image" : ""}`}>
        {heroImage ? <img src={heroImage} alt="" /> : <div className="memory-hero-fallback">🌅</div>}
        <div className="memory-hero-shade" />
        <button className="memory-back" onClick={() => nav(-1)} aria-label="Go back"><ArrowLeft /></button>
        <div className="memory-hero-content">
          <span className="memory-completed">Completed</span>
          <h1>{adventure.title}</h1>
          <p>{memoryDate(adventure.date)}{timeLabel ? ` · ${timeLabel}` : ""}</p>
          <p><MapPin /> {adventure.location}</p>
          {adventure.favorite && <span className="memory-favourite"><Heart fill="currentColor" /> Favourite</span>}
        </div>
      </section>

      <div className="memory-detail-content">
        {loading ? <p className="inline-state" role="status">Gathering this memory…</p> : loadError ? (
          <div className="memory-inline-error" role="alert"><p>{loadError}</p><button onClick={() => void reloadMemory()}>Try again</button></div>
        ) : memory && (
          <>
            <section className="memory-reflection-card">
              <div className="memory-section-heading">
                <div><small>Shared by your space</small><h2>Our reflection</h2></div>
                {!editing && <button onClick={() => setEditing(true)}><Pencil /> Edit</button>}
              </div>
              {editing ? (
                <div className="memory-reflection-editor">
                  <label htmlFor="memory-reflection">What made this day memorable?</label>
                  <textarea id="memory-reflection" autoFocus maxLength={2000} rows={5} value={reflection} onChange={(event) => setReflection(event.target.value)} />
                  <div className="memory-editor-meta"><span>{reflection.length}/2000</span><div><button className="button-secondary" onClick={() => { setReflection(memory.reflection); setEditing(false); setSaveError(null); }} disabled={saving}>Cancel</button><button className="button-primary" onClick={() => void saveReflection()} disabled={saving}>{saving ? "Saving…" : "Save reflection"}</button></div></div>
                  {saveError && <p className="form-error" role="alert">{saveError}</p>}
                </div>
              ) : memory.reflection ? (
                <><blockquote>{memory.reflection}</blockquote>{memory.updatedBy && <p className="memory-updated">Last updated by {memory.updatedBy}</p>}</>
              ) : (
                <button className="memory-reflection-empty" onClick={() => setEditing(true)}>Add a few words about what made this day memorable.</button>
              )}
            </section>

            <section className="memory-gallery-section">
              <div className="memory-section-heading">
                <div><small>{memory.photos.length ? `${memory.photos.length} ${memory.photos.length === 1 ? "photo" : "photos"}` : "Your shared album"}</small><h2>Photos</h2></div>
                <button className="button-primary memory-add-photos" onClick={() => fileInputRef.current?.click()}><ImagePlus /> Add photos</button>
                <input ref={fileInputRef} className="sr-only" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => void uploadFiles(event)} />
              </div>
              {uploads.length > 0 && <div className="memory-upload-list" aria-live="polite">{uploads.map((item) => <div className={item.status} key={item.id}><span>{item.status === "uploading" ? "Uploading" : "Could not upload"} {item.name}</span>{item.message && <small>{item.message}</small>}{item.status === "failed" && <button onClick={() => setUploads((current) => current.filter((upload) => upload.id !== item.id))} aria-label={`Dismiss ${item.name} error`}><X /></button>}</div>)}</div>}
              {memory.photos.length ? (
                <div className="memory-photo-grid">{memory.photos.map((photo, index) => {
                  const canDelete = isOwner || photo.uploadedByUserId === user?.id;
                  return <article className="memory-photo" key={photo.id}><button className="memory-photo-open" onClick={() => setLightboxIndex(index)}><img src={photo.url} alt={photo.caption || `Memory uploaded by ${photo.uploadedBy}`} /></button><div><span>Added by {photo.uploadedBy}</span>{canDelete && <button onClick={() => { setDeleteError(null); setDeleteCandidate(photo); }} aria-label={`Delete photo added by ${photo.uploadedBy}`}><Trash2 /></button>}</div></article>;
                })}</div>
              ) : (
                <div className="memory-photo-empty"><Camera /><h3>No photos yet</h3><p>Add a few favourites from this adventure.</p><button className="button-primary" onClick={() => fileInputRef.current?.click()}>Add photos</button></div>
              )}
            </section>
          </>
        )}

        <Link className="memory-adventure-link" to={`/adventures/${adventure.id}`}><div><small>The plan behind the memory</small><strong>View adventure details</strong></div><ExternalLink /></Link>
      </div>

      {lightboxIndex !== null && memory?.photos.length ? <Lightbox photos={memory.photos} initialIndex={lightboxIndex} onClose={() => setLightboxIndex(null)} /> : null}
      {deleteCandidate && <div className="memory-confirm-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget && !deleting) setDeleteCandidate(null); }}><div className="memory-confirm" role="dialog" aria-modal="true" aria-labelledby="delete-photo-title"><h2 id="delete-photo-title">Delete this photo?</h2><p>This removes it from the shared memory for everyone.</p>{deleteError && <p className="form-error" role="alert">{deleteError}</p>}<div><button className="button-secondary" onClick={() => setDeleteCandidate(null)} disabled={deleting}>Keep photo</button><button className="danger-button" onClick={() => void confirmDelete()} disabled={deleting}>{deleting ? "Deleting…" : "Delete photo"}</button></div></div></div>}
    </div>
  );
}
