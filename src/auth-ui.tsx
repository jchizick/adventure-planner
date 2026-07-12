import { Heart, LogOut, Mail, Sparkles } from "lucide-react";
import { type FormEvent, type ReactNode, useRef, useState } from "react";
import { useAuth } from "./auth";
import { useWorkspace } from "./workspace";

export function AppLoading({ message = "Opening your adventures…" }) {
  return (
    <main className="access-page" aria-busy="true" aria-live="polite">
      <section className="access-card access-loading">
        <div className="access-mark" aria-hidden="true">
          <Heart fill="currentColor" />
        </div>
        <div className="access-spinner" aria-hidden="true" />
        <p>{message}</p>
      </section>
    </main>
  );
}

export function SignInScreen() {
  const { callbackError, clearCallbackError, sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(callbackError);
  const emailRef = useRef<HTMLInputElement>(null);

  const visibleError = error ?? callbackError;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    clearCallbackError();
    if (!email.trim() || !emailRef.current?.validity.valid) {
      setError("Enter a valid email address.");
      emailRef.current?.focus();
      return;
    }
    setSubmitting(true);
    try {
      await sendMagicLink(email.trim());
      setSent(true);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "We could not send the magic link. Please try again.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <main className="access-page">
      <section className="access-card" aria-labelledby="sign-in-title">
        <div className="access-brand">
          <span className="access-mark" aria-hidden="true">
            <Heart fill="currentColor" />
          </span>
          <span>Our Adventures</span>
        </div>
        <div className="access-copy">
          <p className="eyebrow">Plan together</p>
          <h1 id="sign-in-title">Your next favorite memory starts here.</h1>
          <p>
            Sign in with a secure link to keep plans, ideas, and little moments
            in one shared place.
          </p>
        </div>

        {sent ? (
          <div className="access-success" role="status" aria-live="polite">
            <Mail aria-hidden="true" />
            <h2>Check your email</h2>
            <p>
              We sent a magic link to <strong>{email}</strong>. Open it on this
              device to continue.
            </p>
            <button
              className="secondary-button"
              onClick={() => {
                setSent(false);
                requestAnimationFrame(() => emailRef.current?.focus());
              }}
            >
              Use a different email
            </button>
          </div>
        ) : (
          <form className="access-form" onSubmit={submit} noValidate>
            <label htmlFor="sign-in-email">Email address</label>
            <input
              ref={emailRef}
              id="sign-in-email"
              type="email"
              inputMode="email"
              autoComplete="email"
              placeholder="you@example.com"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              aria-invalid={!!visibleError}
              aria-describedby={visibleError ? "sign-in-error" : "sign-in-help"}
              autoFocus
            />
            <small id="sign-in-help">
              No password needed. The link expires for your security.
            </small>
            {visibleError && (
              <p className="access-error" id="sign-in-error" role="alert">
                {visibleError}
              </p>
            )}
            <button className="access-primary" disabled={submitting}>
              <Mail aria-hidden="true" />
              {submitting ? "Sending…" : "Send magic link"}
            </button>
          </form>
        )}
        <p className="access-footnote">
          A private space for the people making the plans.
        </p>
      </section>
    </main>
  );
}

function WorkspaceError() {
  const { error, retry } = useWorkspace();
  const { signOut } = useAuth();
  const [signOutError, setSignOutError] = useState<string | null>(null);
  return (
    <main className="access-page">
      <section className="access-card access-center" role="alert">
        <span className="access-mark" aria-hidden="true">
          <Heart fill="currentColor" />
        </span>
        <h1>We hit a small detour.</h1>
        <p>{error}</p>
        {signOutError && <p className="access-error">{signOutError}</p>}
        <div className="access-actions">
          <button className="access-primary" onClick={() => void retry()}>
            Try again
          </button>
          <button
            className="secondary-button"
            onClick={() =>
              void signOut().catch((nextError) =>
                setSignOutError(
                  nextError instanceof Error
                    ? nextError.message
                    : "We could not sign you out.",
                ),
              )
            }
          >
            Sign out
          </button>
        </div>
      </section>
    </main>
  );
}

function ProfileSetup() {
  const { updateDisplayName } = useWorkspace();
  const [name, setName] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await updateDisplayName(name);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "We could not save your name.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="access-page">
      <section className="access-card" aria-labelledby="profile-title">
        <div className="access-brand">
          <span className="access-mark" aria-hidden="true">
            <Heart fill="currentColor" />
          </span>
          <span>Our Adventures</span>
        </div>
        <div className="access-copy">
          <p className="eyebrow">One quick detail</p>
          <h1 id="profile-title">What should we call you?</h1>
          <p>This name will appear beside the plans and ideas you add.</p>
        </div>
        <form className="access-form" onSubmit={submit} noValidate>
          <label htmlFor="display-name">Display name</label>
          <input
            id="display-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "profile-error" : undefined}
            autoComplete="name"
            autoFocus
          />
          {error && (
            <p className="access-error" id="profile-error" role="alert">
              {error}
            </p>
          )}
          <button className="access-primary" disabled={submitting}>
            {submitting ? "Saving…" : "Continue"}
          </button>
        </form>
      </section>
    </main>
  );
}

function SpaceOnboarding() {
  const { createSpace } = useWorkspace();
  const { signOut } = useAuth();
  const [name, setName] = useState("Our Adventures");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await createSpace(name);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "We could not create your shared space.",
      );
    } finally {
      setSubmitting(false);
    }
  };
  return (
    <main className="access-page">
      <section className="access-card" aria-labelledby="space-title">
        <div className="access-brand">
          <span className="access-mark" aria-hidden="true">
            <Heart fill="currentColor" />
          </span>
          <span>Our Adventures</span>
        </div>
        <div className="access-copy">
          <p className="eyebrow">Make it yours</p>
          <h1 id="space-title">Create your shared space.</h1>
          <p>
            This is the private home for plans you make together. You can add
            your person after their account is ready.
          </p>
        </div>
        <div className="onboarding-note">
          <Sparkles aria-hidden="true" />
          <span>
            Your existing prototype adventures will be waiting inside.
          </span>
        </div>
        <form className="access-form" onSubmit={submit} noValidate>
          <label htmlFor="space-name">Shared-space name</label>
          <input
            id="space-name"
            value={name}
            onChange={(event) => setName(event.target.value)}
            aria-invalid={!!error}
            aria-describedby={error ? "space-error" : undefined}
            autoFocus
          />
          {error && (
            <p className="access-error" id="space-error" role="alert">
              {error}
            </p>
          )}
          <button className="access-primary" disabled={submitting}>
            {submitting ? "Creating your space…" : "Create shared space"}
          </button>
        </form>
        <button
          className="access-sign-out"
          onClick={() =>
            void signOut().catch(() =>
              setError("We could not sign you out. Please try again."),
            )
          }
        >
          <LogOut aria-hidden="true" /> Sign out
        </button>
      </section>
    </main>
  );
}

export function WorkspaceGate({ children }: { children: ReactNode }) {
  const { profile, activeSpace, loading, error } = useWorkspace();
  if (loading) return <AppLoading message="Preparing your shared space…" />;
  if (error || !profile) return <WorkspaceError />;
  if (!profile.displayName?.trim()) return <ProfileSetup />;
  if (!activeSpace) return <SpaceOnboarding />;
  return children;
}
