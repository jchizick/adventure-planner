import {
  CalendarDays,
  Heart,
  Image,
  Lightbulb,
  LogOut,
  Plus,
  X,
} from "lucide-react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import type { IdeaStatus } from "./types";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useAuth } from "./auth";
import { useWorkspace } from "./workspace";
export const nav = [
  ["/today", "Today", CalendarDays],
  ["/ideas", "Ideas", Lightbulb],
  ["/calendar", "Calendar", CalendarDays],
  ["/memories", "Memories", Image],
] as const;
export function AppShell() {
  const loc = useLocation();
  const { signOut } = useAuth();
  const { activeSpace, profile } = useWorkspace();
  const [signingOut, setSigningOut] = useState(false);
  const [signOutError, setSignOutError] = useState<string | null>(null);
  const detail = loc.pathname.startsWith("/adventures/");
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
          <span>Our Adventures</span>
          <Heart size={18} fill="currentColor" />
        </div>
        <p className="couple">{activeSpace?.name ?? "Our Adventures"}</p>
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
          <button onClick={() => void handleSignOut()} disabled={signingOut}>
            <LogOut aria-hidden="true" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
          {signOutError && <small role="alert">{signOutError}</small>}
        </div>
      </aside>
      <div className="mobile-account">
        <span>{activeSpace?.name}</span>
        <button
          onClick={() => void handleSignOut()}
          disabled={signingOut}
          aria-label="Sign out"
        >
          <LogOut aria-hidden="true" />
        </button>
        {signOutError && <small role="alert">{signOutError}</small>}
      </div>
      <main className={detail ? "detail-main" : ""}>
        <Outlet />
      </main>
      {!detail && (
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
  action,
}: {
  title: string;
  eyebrow?: string;
  action?: ReactNode;
}) {
  return (
    <header className="page-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h1>{title}</h1>
      </div>
      {action}
    </header>
  );
}
export function StatusChip({ status }: { status: IdeaStatus }) {
  return <span className={`status ${status.toLowerCase()}`}>{status}</span>;
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
export function QuickAdd({ onClick }: { onClick: () => void }) {
  return (
    <button className="quick-add" onClick={onClick} aria-label="Quick add">
      <Plus />
    </button>
  );
}
