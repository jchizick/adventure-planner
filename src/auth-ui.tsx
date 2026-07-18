import {
  ArrowRight,
  CalendarDays,
  ChevronDown,
  Heart,
  Lightbulb,
  LockKeyhole,
  LogOut,
  Mail,
  MapPin,
  Sparkles,
} from "lucide-react";
import {
  type FormEvent,
  type ReactNode,
  type RefObject,
  useRef,
  useState,
} from "react";
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

const workflowStages = [
  {
    name: "Ideas",
    description: "Save something you want to do.",
    Icon: Lightbulb,
    accent: "ideas",
  },
  {
    name: "Adventure",
    description: "Choose the date and details.",
    Icon: CalendarDays,
    accent: "adventure",
  },
  {
    name: "Itinerary",
    description: "Plan the stops together.",
    Icon: MapPin,
    accent: "itinerary",
  },
  {
    name: "Memories",
    description: "Add photos and reflections.",
    Icon: Heart,
    accent: "memories",
  },
] as const;

function BrandLogo({ className = "" }: { className?: string }) {
  return (
    <img
      className={`welcome-brand-logo ${className}`.trim()}
      src="/our-adventures-logo.svg"
      alt="Our Adventures"
    />
  );
}

function AdventureWorkflow({
  workflowRef,
}: {
  workflowRef: RefObject<HTMLElement | null>;
}) {
  return (
    <section
      className="welcome-workflow"
      ref={workflowRef}
      tabIndex={-1}
      aria-labelledby="welcome-workflow-title"
    >
      <h2 id="welcome-workflow-title" className="sr-only">
        How Our Adventures works
      </h2>
      <ol className="welcome-workflow-list">
        {workflowStages.flatMap(
          ({ name, description, Icon, accent }, index) => [
            <li className={`welcome-workflow-stage ${accent}`} key={name}>
              <span className="welcome-workflow-icon" aria-hidden="true">
                <Icon />
              </span>
              <div className="welcome-workflow-content">
                <h3>{name}</h3>
                <p>{description}</p>
              </div>
            </li>,
            ...(index < workflowStages.length - 1
              ? [
                  <li
                    className="welcome-workflow-connector"
                    aria-hidden="true"
                    key={`${name}-connector`}
                  >
                    <span>
                      <ArrowRight />
                    </span>
                  </li>,
                ]
              : []),
          ],
        )}
      </ol>
    </section>
  );
}

function DecorativeBotanical() {
  return (
    <svg
      className="welcome-botanical"
      viewBox="0 0 180 96"
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M10 88C39 70 45 38 75 17M42 62c-15-1-24-8-28-19 15-2 26 4 31 14M57 42c-4-14 0-26 12-35 7 14 5 26-7 35M70 25c11 1 21 7 27 19-14 3-25-2-31-12M77 76c25-17 43-30 79-35M111 59c-2-13 2-23 13-31 6 13 4 24-8 32M132 49c9 1 18 6 24 15-12 4-21 1-28-9" />
      <path d="M91 72c4-7 13-8 18-2 5-6 14-5 17 2 4 10-17 21-17 21S87 82 91 72Z" />
    </svg>
  );
}

function WelcomeIntro({ workflowRef }: { workflowRef: RefObject<HTMLElement | null> }) {
  return (
    <div className="welcome-intro">
      <div className="welcome-intro-copy">
        <p className="welcome-eyebrow">PRIVATE SHARED PLANNER</p>
        <h1 id="welcome-title">
          Plan it together.
          <br />
          Live it together.
          <br />
          Remember it all.
        </h1>
        <p className="welcome-description">
          A private shared space for saving ideas, planning adventures,
          organizing every stop, and keeping the memories afterward.
        </p>
      </div>

      <AdventureWorkflow workflowRef={workflowRef} />

      <div className="welcome-closing">
        <Heart fill="currentColor" aria-hidden="true" />
        <span>From “we should do that” to “remember when we did?”</span>
      </div>
      <DecorativeBotanical />
    </div>
  );
}

function MobileWorkflowDetails({
  detailsRef,
  summaryRef,
}: {
  detailsRef: RefObject<HTMLDetailsElement | null>;
  summaryRef: RefObject<HTMLElement | null>;
}) {
  return (
    <details className="welcome-mobile-details" ref={detailsRef}>
      <summary ref={summaryRef}>How it works</summary>
      <ol>
        {workflowStages.map(({ name, description, Icon }) => (
          <li key={name}>
            <Icon aria-hidden="true" />
            <span>
              <strong>{name}</strong>
              {description}
            </span>
          </li>
        ))}
      </ol>
    </details>
  );
}

export function SignInScreen({
  redirectPath = "/today",
  invitation = false,
}: {
  redirectPath?: string;
  invitation?: boolean;
} = {}) {
  const { callbackError, clearCallbackError, sendMagicLink } = useAuth();
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(callbackError);
  const emailRef = useRef<HTMLInputElement>(null);
  const workflowRef = useRef<HTMLElement>(null);
  const mobileWorkflowRef = useRef<HTMLDetailsElement>(null);
  const mobileWorkflowSummaryRef = useRef<HTMLElement>(null);

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
      await sendMagicLink(email.trim(), redirectPath);
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

  const showWorkflow = () => {
    const reduceMotion = window.matchMedia?.(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    const mobileLayout = window.matchMedia?.("(max-width: 1100px)").matches;
    const target = mobileLayout
      ? mobileWorkflowSummaryRef.current
      : workflowRef.current;
    if (!target) return;

    if (mobileLayout && mobileWorkflowRef.current) {
      mobileWorkflowRef.current.open = true;
    }
    target.scrollIntoView({
      behavior: reduceMotion ? "auto" : "smooth",
      block: "center",
    });
    target.focus({ preventScroll: true });
  };

  return (
    <main className="access-page welcome-page" aria-labelledby="welcome-title">
      <section className="welcome-shell">
        <header className="welcome-header">
          <BrandLogo />
          <button
            type="button"
            className="welcome-learn-more"
            onClick={showWorkflow}
            aria-label="Learn more about how Our Adventures works"
          >
            Learn more
            <ChevronDown aria-hidden="true" />
          </button>
        </header>

        <div className="welcome-layout">
          <WelcomeIntro workflowRef={workflowRef} />

          <div className="welcome-sign-in-area">
            <section
              className="access-card welcome-sign-in-card"
              aria-labelledby="sign-in-title"
            >
              <BrandLogo className="welcome-card-logo" />
              <div className="access-copy">
                <p className="eyebrow">SIGN IN</p>
                <h2 id="sign-in-title">
                  Your shared
                  <br className="welcome-heading-break" /> adventures start
                  here.
                </h2>
                <p>
                  Sign in with a secure email link to access your ideas, plans,
                  itineraries, and memories.
                </p>
                {invitation && (
                  <p className="welcome-invitation-note">
                    Use the email address that received your invitation.
                  </p>
                )}
              </div>

              {sent ? (
                <div
                  className="access-success"
                  role="status"
                  aria-live="polite"
                >
                  <Mail aria-hidden="true" />
                  <h2>Check your email</h2>
                  <p>
                    We sent a magic link to <strong>{email}</strong>. Open it on
                    this device to continue.
                  </p>
                  <button
                    type="button"
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
                    aria-describedby={
                      visibleError ? "sign-in-error" : "sign-in-help"
                    }
                    autoFocus
                  />
                  <small id="sign-in-help" className="welcome-sign-in-help">
                    <span>We’ll email you a secure sign-in link.</span>
                    <span>No password required.</span>
                  </small>
                  {visibleError && (
                    <p className="access-error" id="sign-in-error" role="alert">
                      {visibleError}
                    </p>
                  )}
                  <button
                    type="submit"
                    className="access-primary"
                    disabled={submitting}
                  >
                    <Mail aria-hidden="true" />
                    <span>{submitting ? "Sending…" : "Send magic link"}</span>
                  </button>
                </form>
              )}
              <p className="access-footnote">
                <LockKeyhole aria-hidden="true" />
                <span>
                  Invitations and shared spaces are tied to your email.
                </span>
              </p>
            </section>
          </div>
        </div>
        <MobileWorkflowDetails
          detailsRef={mobileWorkflowRef}
          summaryRef={mobileWorkflowSummaryRef}
        />
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
