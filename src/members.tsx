import { Check, Copy, Mail, Shield, UserMinus, Users, X } from "lucide-react";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "./auth";
import { AppLoading, SignInScreen } from "./auth-ui";
import { PageHeader } from "./components";
import {
  acceptInvitation,
  createSpaceInvitation,
  loadInvitation,
  loadSpaceInvitations,
  loadSpaceMembers,
  removeMember,
  revokeInvitation,
  type InvitationPreview,
  type SpaceInvitation,
  type SpaceMember,
} from "./repositories/invitations";
import { useWorkspace } from "./workspace";

const formatDate = (value: string) =>
  new Intl.DateTimeFormat(undefined, { dateStyle: "medium" }).format(
    new Date(value),
  );

export function MembersSettings() {
  const { user } = useAuth();
  const {
    activeSpace,
    memberships,
    spaces,
    selectSpace,
  } = useWorkspace();
  const [members, setMembers] = useState<SpaceMember[]>([]);
  const [invitations, setInvitations] = useState<SpaceInvitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState<string | null>(null);
  const [developmentUrl, setDevelopmentUrl] = useState<string | null>(null);
  const inviteRef = useRef<HTMLInputElement>(null);
  const membership = memberships.find(
    (entry) => entry.spaceId === activeSpace?.id,
  );
  const isOwner = membership?.role === "owner";

  const refresh = useCallback(async () => {
    if (!activeSpace) return;
    setLoading(true);
    setError(null);
    try {
      const [nextMembers, nextInvitations] = await Promise.all([
        loadSpaceMembers(activeSpace.id),
        isOwner ? loadSpaceInvitations(activeSpace.id) : Promise.resolve([]),
      ]);
      setMembers(nextMembers);
      setInvitations(nextInvitations);
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "We could not load the people in this space.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeSpace, isOwner]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void refresh());
    return () => window.cancelAnimationFrame(frame);
  }, [refresh]);

  const pending = useMemo(
    () => invitations.filter((invitation) => invitation.status === "pending"),
    [invitations],
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!activeSpace || submitting) return;
    if (!inviteRef.current?.validity.valid || !email.trim()) {
      setError("Enter a valid email address.");
      inviteRef.current?.focus();
      return;
    }
    setSubmitting(true);
    setError(null);
    setSuccess(null);
    setDevelopmentUrl(null);
    try {
      const result = await createSpaceInvitation(activeSpace.id, email);
      setEmail("");
      setSuccess(
        result.delivered
          ? `Invitation sent to ${result.email}.`
          : result.deliveryMessage,
      );
      setDevelopmentUrl(result.developmentUrl);
      await refresh();
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "We could not create this invitation.",
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (!activeSpace) return null;

  return (
    <section className="members-page">
      <PageHeader eyebrow="Shared space" title="People & invitations" />

      {spaces.length > 1 && (
        <label className="space-switcher">
          Active space
          <select
            value={activeSpace.id}
            onChange={(event) => selectSpace(event.target.value)}
          >
            {spaces.map((space) => (
              <option key={space.id} value={space.id}>
                {space.name}
              </option>
            ))}
          </select>
        </label>
      )}

      {error && (
        <p className="settings-message error" role="alert">
          {error}
        </p>
      )}
      {success && (
        <div className="settings-message success" role="status" aria-live="polite">
          <Check aria-hidden="true" />
          <span>{success}</span>
          {developmentUrl && (
            <button
              type="button"
              onClick={() => void navigator.clipboard.writeText(developmentUrl)}
            >
              <Copy aria-hidden="true" /> Copy development invite link
            </button>
          )}
        </div>
      )}

      {isOwner && (
        <section className="settings-card" aria-labelledby="invite-heading">
          <div className="settings-card-heading">
            <Mail aria-hidden="true" />
            <div>
              <h2 id="invite-heading">Invite your person</h2>
              <p>They’ll join as a member after signing in with this email.</p>
            </div>
          </div>
          <form className="invite-form" onSubmit={submit} noValidate>
            <label htmlFor="invite-email">Email address</label>
            <div>
              <input
                ref={inviteRef}
                id="invite-email"
                type="email"
                inputMode="email"
                autoComplete="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                disabled={submitting}
              />
              <button className="primary" disabled={submitting}>
                {submitting ? "Creating invitation…" : "Invite member"}
              </button>
            </div>
          </form>
        </section>
      )}

      <section className="settings-card" aria-labelledby="members-heading">
        <div className="settings-card-heading">
          <Users aria-hidden="true" />
          <div>
            <h2 id="members-heading">Members</h2>
            <p>{activeSpace.name}</p>
          </div>
        </div>
        {loading ? (
          <p className="inline-state" role="status">Loading members…</p>
        ) : (
          <div className="people-list">
            {members.map((member) => (
              <article className="person-row" key={member.userId}>
                <span className="person-avatar" aria-hidden="true">
                  {(member.displayName || member.email).slice(0, 1).toUpperCase()}
                </span>
                <div>
                  <strong>{member.displayName || "Adventure planner"}</strong>
                  <small>{member.email}</small>
                  <small>Joined {formatDate(member.joinedAt)}</small>
                </div>
                <div className="person-role">
                  {member.role === "owner" && <Shield aria-hidden="true" />}
                  <span>{member.role === "owner" ? "Owner" : "Member"}</span>
                  {member.userId === user?.id && <small>You</small>}
                </div>
                {isOwner && member.role === "member" && (
                  <button
                    className="icon-button danger"
                    aria-label={`Remove ${member.displayName || member.email}`}
                    onClick={() => {
                      if (!window.confirm("Remove this member from the shared space?")) return;
                      setError(null);
                      void removeMember(activeSpace.id, member.userId)
                        .then(refresh)
                        .catch((nextError) =>
                          setError(nextError instanceof Error ? nextError.message : "The member could not be removed."),
                        );
                    }}
                  >
                    <UserMinus aria-hidden="true" />
                  </button>
                )}
              </article>
            ))}
          </div>
        )}
      </section>

      {isOwner && (
        <section className="settings-card" aria-labelledby="pending-heading">
          <div className="settings-card-heading">
            <Mail aria-hidden="true" />
            <div>
              <h2 id="pending-heading">Pending invitations</h2>
              <p>{pending.length ? `${pending.length} waiting` : "No pending invitations"}</p>
            </div>
          </div>
          <div className="people-list">
            {pending.map((invitation) => (
              <article className="person-row invitation-row" key={invitation.id}>
                <span className="person-avatar" aria-hidden="true"><Mail /></span>
                <div>
                  <strong>{invitation.email}</strong>
                  <small>Invited {formatDate(invitation.createdAt)}</small>
                  <small>Expires {formatDate(invitation.expiresAt)}</small>
                </div>
                <span className={`invitation-status ${invitation.status}`}>{invitation.status}</span>
                <button
                  className="icon-button danger"
                  aria-label={`Revoke invitation for ${invitation.email}`}
                  onClick={() => {
                    if (!window.confirm("Revoke this invitation?")) return;
                    setError(null);
                    void revokeInvitation(activeSpace.id, invitation.id)
                      .then(refresh)
                      .catch((nextError) =>
                        setError(nextError instanceof Error ? nextError.message : "The invitation could not be revoked."),
                      );
                  }}
                >
                  <X aria-hidden="true" />
                </button>
              </article>
            ))}
          </div>
        </section>
      )}
    </section>
  );
}

export function InvitePage() {
  const { token = "" } = useParams();
  const navigate = useNavigate();
  const { loading: authLoading, user } = useAuth();
  const {
    profile,
    loading: workspaceLoading,
    error: workspaceError,
    refreshMemberships,
  } = useWorkspace();
  const [invitation, setInvitation] = useState<InvitationPreview | null>(null);
  const [loading, setLoading] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user || workspaceLoading) return;
    let active = true;
    void loadInvitation(token)
      .then((nextInvitation) => {
        if (active) setInvitation(nextInvitation);
      })
      .catch((nextError) => {
        if (active)
          setError(nextError instanceof Error ? nextError.message : "This invitation could not be opened.");
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
    };
  }, [token, user, workspaceLoading]);

  if (authLoading) return <AppLoading message="Opening your invitation…" />;
  if (!user)
    return <SignInScreen invitation redirectPath={`/invite/${encodeURIComponent(token)}`} />;
  if (workspaceLoading || loading)
    return <AppLoading message="Checking your invitation…" />;

  return (
    <main className="access-page">
      <section className="access-card invite-card" aria-labelledby="invite-title">
        <div className="access-brand"><Users aria-hidden="true" /><span>Our Adventures</span></div>
        {error || workspaceError || !profile || !invitation ? (
          <div className="access-copy" role="alert">
            <p className="eyebrow">Invitation unavailable</p>
            <h1 id="invite-title">This link can’t be accepted.</h1>
            <p>{error || workspaceError || "The invitation may be invalid, expired, revoked, or intended for another account."}</p>
          </div>
        ) : (
          <>
            <div className="access-copy">
              <p className="eyebrow">You’re invited</p>
              <h1 id="invite-title">Join {invitation.spaceName}</h1>
              <p>{invitation.inviterName} invited {invitation.invitedEmail} to plan adventures together.</p>
            </div>
            <div className={`invitation-summary ${invitation.status}`}>
              <span>Status</span><strong>{invitation.status}</strong>
              <span>Expires</span><strong>{formatDate(invitation.expiresAt)}</strong>
            </div>
            {invitation.status === "pending" ? (
              <button
                className="access-primary"
                disabled={accepting}
                onClick={() => {
                  if (accepting) return;
                  setAccepting(true);
                  setError(null);
                  void acceptInvitation(token)
                    .then(async (space) => {
                      await refreshMemberships(space.id);
                      navigate("/today", { replace: true });
                    })
                    .catch((nextError) => {
                      setError(nextError instanceof Error ? nextError.message : "The invitation could not be accepted.");
                      setAccepting(false);
                    });
                }}
              >
                {accepting ? "Joining space…" : "Accept invitation"}
              </button>
            ) : (
              <p className="access-error" role="status">
                This invitation is {invitation.status} and cannot be used.
              </p>
            )}
          </>
        )}
      </section>
    </main>
  );
}
