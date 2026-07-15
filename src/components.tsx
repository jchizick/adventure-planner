import {
  CalendarDays,
  CalendarHeart,
  Image,
  Lightbulb,
  LogOut,
  Plus,
  Users,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { IdeaStatus } from "./types";
import {
  useEffect,
  useId,
  useRef,
  useState,
  type ImgHTMLAttributes,
  type ReactNode,
} from "react";
import { createPortal } from "react-dom";
import { useAuth } from "./auth";
import { useWorkspace } from "./workspace";
export const nav = [
  ["/today", "Today", CalendarHeart],
  ["/ideas", "Ideas", Lightbulb],
  ["/calendar", "Calendar", CalendarDays],
  ["/memories", "Memories", Image],
] as const;
export function AppShell() {
  const loc = useLocation();
  const { signOut } = useAuth();
  const { profile } = useWorkspace();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const adventureDetail = loc.pathname.startsWith("/adventures/");
  const memoryDetail = loc.pathname.startsWith("/memories/");
  const detail = adventureDetail || memoryDetail;
  const handleSignOut = async () => {
    setSigningOut(true);
    setSignOutError(null);
    try {
      await signOut();
    } catch (error) {
      setSignOutError(
        error instanceof Error ? error.message : "We could not sign you out.",
      );
      setSigningOut(false);
    }
  };
  return (
    <div className="app-frame">
      <aside className="desktop-nav">
        <div className="brand">
          <img
            className="app-logo app-logo-desktop"
            src="/our-adventures-logo.svg"
            alt="Our Adventures"
          />
        </div>
        <nav>
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to}>
              <Icon size={20} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
        <div className="side-note">
          Plan together.
          <br />
          Experience more.
          <br />
          Make memories.
        </div>
        <div className="account-panel">
          <span>{profile?.displayName}</span>
          <NavLink className="members-link" to="/settings/members">
            <Users aria-hidden="true" />
            People & invitations
          </NavLink>
          <button onClick={() => void handleSignOut()} disabled={signingOut}>
            <LogOut aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          {signOutError && <small role="alert">{signOutError}</small>}
        </div>
      </aside>
      <div className="mobile-account">
        <div className="mobile-space-title">
          <img
            className="app-logo app-logo-mobile"
            src="/our-adventures-logo.svg"
            alt="Our Adventures"
          />
        </div>
        <div className="mobile-account-actions">
          <NavLink to="/settings/members" aria-label="People and invitations">
            <Users aria-hidden="true" />
          </NavLink>
          <button
            onClick={() => void handleSignOut()}
            disabled={signingOut}
            aria-label="Sign out"
          >
            <LogOut aria-hidden="true" />
          </button>
        </div>
        {signOutError && <small role="alert">{signOutError}</small>}
      </div>
      <main className={detail ? "detail-main" : ""}>
        <Outlet />
      </main>
      {!adventureDetail && (
        <nav className="bottom-nav">
          {nav.map(([to, label, Icon]) => (
            <NavLink key={to} to={to}>
              <Icon size={21} />
              <span>{label}</span>
            </NavLink>
          ))}
        </nav>
      )}
    </div>
  );
}
export function PageHeader({
  title,
  eyebrow,
  eyebrowClassName,
  action,
}: {
  title: string;
  eyebrow?: string;
  eyebrowClassName?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && (
          <p className={`eyebrow${eyebrowClassName ? ` ${eyebrowClassName}` : ""}`}>
            {eyebrow}
          </p>
        )}
        <h1>{title}</h1>
      </div>
      {action}
    </header>
  );
}
export function StatusChip({ status }: { status: IdeaStatus }) {
  return <span className={`status ${status.toLowerCase()}`}>{status}</span>;
}
export function SafeImage({
  src,
  fallbackSrc,
  style,
  ...props
}: Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "onError"> & {
  src: string;
  fallbackSrc: string;
}) {
  const [failedPrimary, setFailedPrimary] = useState<string | null>(null);
  const [failedFallbackFor, setFailedFallbackFor] = useState<string | null>(null);
  const renderedSrc = failedPrimary === src ? fallbackSrc : src;
  const hidden = renderedSrc === fallbackSrc && failedFallbackFor === src;
  return (
    <img
      {...props}
      src={renderedSrc}
      style={{ ...style, visibility: hidden ? "hidden" : style?.visibility }}
      onError={() => {
        if (renderedSrc !== fallbackSrc) setFailedPrimary(src);
        else setFailedFallbackFor(src);
      }}
    />
  );
}
export function Sheet({
  open,
  onClose,
  title,
  children,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const panelRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => {
    closeRef.current = onClose;
  }, [onClose]);
  useEffect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = requestAnimationFrame(() => {
      const target =
        panelRef.current?.querySelector<HTMLElement>(
          "input, textarea, select",
        ) ?? panelRef.current?.querySelector<HTMLElement>("button");
      target?.focus();
    });
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") closeRef.current();
    };
    document.addEventListener("keydown", handleKey);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey);
      previous?.focus();
    };
  }, [open]);
  if (!open) return null;
  return (
    <div className="sheet-backdrop" onMouseDown={onClose}>
      <section
        ref={panelRef}
        className="sheet"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div className="sheet-handle" />
        <header>
          <h2>{title}</h2>
          <button className="icon-button" onClick={onClose} aria-label="Close">
            <X />
          </button>
        </header>
        {children}
      </section>
    </div>
  );
}

export function ConfirmationDialog({
  open,
  title,
  body,
  confirmLabel,
  pendingLabel,
  pending = false,
  error,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  title: string;
  body: string;
  confirmLabel: string;
  pendingLabel: string;
  pending?: boolean;
  error?: string | null;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  const titleId = useId();
  const bodyId = useId();
  const dialogRef = useRef<HTMLDivElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const onCancelRef = useRef(onCancel);
  const pendingRef = useRef(pending);

  useEffect(() => {
    onCancelRef.current = onCancel;
    pendingRef.current = pending;
  }, [onCancel, pending]);

  useEffect(() => {
    if (!open) return;
    const previous =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    const frame = requestAnimationFrame(() => cancelRef.current?.focus());
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopImmediatePropagation();
        if (!pendingRef.current) onCancelRef.current();
        return;
      }
      if (event.key !== "Tab") return;
      const controls = Array.from(
        dialogRef.current?.querySelectorAll<HTMLElement>(
          "button:not(:disabled)",
        ) ?? [],
      );
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
    };
    document.addEventListener("keydown", handleKey, true);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKey, true);
      previous?.focus();
    };
  }, [open]);

  if (!open) return null;
  return createPortal(
    <div
      className="confirmation-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !pending) onCancel();
      }}
    >
      <div
        ref={dialogRef}
        className="confirmation-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={bodyId}
      >
        <h2 id={titleId}>{title}</h2>
        <p id={bodyId}>{body}</p>
        {error && <p className="form-error" role="alert">{error}</p>}
        <div className="confirmation-actions">
          <button
            ref={cancelRef}
            type="button"
            className="button-secondary"
            onClick={onCancel}
            disabled={pending}
          >
            Cancel
          </button>
          <button
            type="button"
            className="danger-button"
            onClick={onConfirm}
            disabled={pending}
          >
            {pending ? pendingLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>,
    document.body,
  );
}
export function QuickAdd({ onClick }: { onClick: () => void }) {
  return (
    <button className="quick-add" onClick={onClick} aria-label="Quick add">
      <Plus />
    </button>
  );
}
