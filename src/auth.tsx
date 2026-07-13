import type { Session, User } from "@supabase/supabase-js";
import {
  createContext,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { supabase } from "./lib/supabase";

type AuthState = {
  session: Session | null;
  user: User | null;
  loading: boolean;
  callbackError: string | null;
  clearCallbackError: () => void;
  sendMagicLink: (email: string, redirectPath?: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

const callbackErrorFromLocation = () => {
  const query = new URLSearchParams(window.location.search);
  const hash = new URLSearchParams(window.location.hash.slice(1));
  if (!query.get("error") && !hash.get("error")) return null;
  return "This sign-in link is invalid or has expired. Request a new magic link.";
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [callbackError, setCallbackError] = useState<string | null>(() =>
    callbackErrorFromLocation(),
  );

  useEffect(() => {
    if (!callbackError) return;
    const query = new URLSearchParams(window.location.search);
    query.delete("error");
    query.delete("error_code");
    query.delete("error_description");
    const cleanQuery = query.toString();
    window.history.replaceState(
      null,
      "",
      `${window.location.pathname}${cleanQuery ? `?${cleanQuery}` : ""}`,
    );
  }, [callbackError]);

  useEffect(() => {
    let active = true;
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return;
      setSession(nextSession);
      setLoading(false);
      if (nextSession) setCallbackError(null);
    });

    void supabase.auth.getSession().then(({ data, error }) => {
      if (!active) return;
      if (error) {
        setCallbackError(
          "We could not restore your session. Please request a new magic link.",
        );
      }
      setSession(data.session);
      setLoading(false);
    });

    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      session,
      user: session?.user ?? null,
      loading,
      callbackError,
      clearCallbackError: () => setCallbackError(null),
      sendMagicLink: async (email, redirectPath = "/today") => {
        const redirectUrl = new URL(
          redirectPath.startsWith("/") ? redirectPath : "/today",
          window.location.origin,
        ).toString();
        const { error } = await supabase.auth.signInWithOtp({
          email,
          options: { emailRedirectTo: redirectUrl },
        });
        if (error) {
          const diagnostic = {
            name: error.name,
            message: error.message,
            status: error.status,
            code: error.code,
          };
          if (import.meta.env.DEV)
            console.error(
              "Supabase magic-link request failed",
              JSON.stringify(diagnostic),
            );
          if (error.status === 429)
            throw new Error(
              "Please wait a moment before requesting another link.",
            );
          if (import.meta.env.DEV)
            throw new Error(
              `Magic-link request failed: ${error.code ?? error.name} (${error.status ?? "no status"}) — ${error.message}`,
            );
          throw new Error(
            "We could not send the magic link. Check your email and try again.",
          );
        }
      },
      signOut: async () => {
        const { error } = await supabase.auth.signOut();
        if (error)
          throw new Error("We could not sign you out. Please try again.");
      },
    }),
    [callbackError, loading, session],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used within AuthProvider");
  return context;
}
