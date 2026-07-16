import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { useAuth } from "./auth";
import { supabase } from "./lib/supabase";

export type Profile = {
  id: string;
  displayName: string | null;
  avatarUrl: string | null;
};

export type SharedSpace = {
  id: string;
  name: string;
  createdBy: string;
};

export type SpaceMembership = {
  spaceId: string;
  userId: string;
  role: "owner" | "member";
  createdAt: string;
};

type WorkspaceState = {
  profile: Profile | null;
  activeSpace: SharedSpace | null;
  spaces: SharedSpace[];
  memberships: SpaceMembership[];
  loading: boolean;
  error: string | null;
  retry: () => Promise<void>;
  refreshMemberships: (preferredSpaceId?: string) => Promise<void>;
  selectSpace: (spaceId: string) => void;
  updateDisplayName: (name: string) => Promise<void>;
  updateSpaceName: (name: string) => Promise<void>;
  createSpace: (name: string) => Promise<void>;
};

const WorkspaceContext = createContext<WorkspaceState | null>(null);
const wait = (milliseconds: number) =>
  new Promise((resolve) => window.setTimeout(resolve, milliseconds));

async function loadProfile(userId: string): Promise<Profile> {
  for (const delay of [0, 250, 600, 1200]) {
    if (delay) await wait(delay);
    const { data, error } = await supabase
      .from("profiles")
      .select("id, display_name, avatar_url")
      .eq("id", userId)
      .maybeSingle();
    if (error)
      throw new Error("We could not load your profile. Please try again.");
    if (data)
      return {
        id: data.id,
        displayName: data.display_name,
        avatarUrl: data.avatar_url,
      };
  }
  throw new Error(
    "Your profile is still being prepared. Wait a moment and try again.",
  );
}

async function loadMemberships(userId: string) {
  const { data, error } = await supabase
    .from("space_members")
    .select("space_id, user_id, role, created_at")
    .eq("user_id", userId);
  if (error)
    throw new Error("We could not load your shared spaces. Please try again.");
  return (data ?? []).map((membership): SpaceMembership => ({
    spaceId: membership.space_id,
    userId: membership.user_id,
    role: membership.role as SpaceMembership["role"],
    createdAt: membership.created_at,
  }));
}

async function loadSpaces(memberships: SpaceMembership[]) {
  if (!memberships.length) return [];
  const { data, error } = await supabase
    .from("spaces")
    .select("id, name, created_by")
    .in(
      "id",
      memberships.map((membership) => membership.spaceId),
    );
  if (error)
    throw new Error("We could not open your shared space. Please try again.");
  return (data ?? []).map((space): SharedSpace => ({
    id: space.id,
    name: space.name,
    createdBy: space.created_by,
  }));
}

export function WorkspaceProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userId = user?.id;
  const [profile, setProfile] = useState<Profile | null>(null);
  const [activeSpace, setActiveSpace] = useState<SharedSpace | null>(null);
  const [spaces, setSpaces] = useState<SharedSpace[]>([]);
  const [memberships, setMemberships] = useState<SpaceMembership[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const creatingSpaceRef = useRef(false);

  const load = useCallback(async (preferredSpaceId?: string) => {
    if (!userId) return;
    setLoading(true);
    setError(null);
    try {
      const [nextProfile, nextMemberships] = await Promise.all([
        loadProfile(userId),
        loadMemberships(userId),
      ]);
      const spaces = await loadSpaces(nextMemberships);
      setProfile(nextProfile);
      setMemberships(nextMemberships);
      setSpaces(spaces);
      const persistedSpaceId = window.localStorage.getItem(
        `our-adventures:active-space:${userId}`,
      );
      const requestedSpaceId = preferredSpaceId ?? persistedSpaceId;
      const nextSpace =
        spaces.find((space) => space.id === requestedSpaceId) ?? spaces[0] ?? null;
      setActiveSpace(nextSpace);
      if (nextSpace)
        window.localStorage.setItem(
          `our-adventures:active-space:${userId}`,
          nextSpace.id,
        );
    } catch (nextError) {
      setError(
        nextError instanceof Error
          ? nextError.message
          : "We could not prepare your shared space.",
      );
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const value = useMemo<WorkspaceState>(
    () => ({
      profile,
      activeSpace,
      spaces,
      memberships,
      loading,
      error,
      retry: () => load(),
      refreshMemberships: load,
      selectSpace: (spaceId) => {
        const nextSpace = spaces.find((space) => space.id === spaceId);
        if (!nextSpace || !user) return;
        setActiveSpace(nextSpace);
        window.localStorage.setItem(
          `our-adventures:active-space:${user.id}`,
          nextSpace.id,
        );
      },
      updateDisplayName: async (name) => {
        if (!user) throw new Error("Sign in again to update your profile.");
        const displayName = name.trim();
        if (!displayName)
          throw new Error("Enter the name you would like to use.");
        if (displayName.length > 50)
          throw new Error("Display names can be up to 50 characters.");
        const { data, error: updateError } = await supabase
          .from("profiles")
          .update({ display_name: displayName })
          .eq("id", user.id)
          .select("display_name")
          .single();
        if (updateError || !data)
          throw new Error("We could not save your name. Please try again.");
        const savedDisplayName = data.display_name?.trim() || displayName;
        setProfile((current) =>
          current ? { ...current, displayName: savedDisplayName } : current,
        );
      },
      updateSpaceName: async (name) => {
        if (!user || !activeSpace)
          throw new Error("Open a shared space before updating its name.");
        const spaceName = name.trim();
        if (!spaceName) throw new Error("Enter a name for your shared space.");
        if (spaceName.length > 60)
          throw new Error("Shared-space names can be up to 60 characters.");
        const { data, error: updateError } = await supabase
          .from("spaces")
          .update({ name: spaceName })
          .eq("id", activeSpace.id)
          .select("id, name, created_by")
          .single();
        if (updateError || !data)
          throw new Error("We could not save the shared-space name. Please try again.");
        const nextSpace: SharedSpace = {
          id: data.id,
          name: data.name,
          createdBy: data.created_by,
        };
        setSpaces((current) =>
          current.map((space) => space.id === nextSpace.id ? nextSpace : space),
        );
        setActiveSpace((current) =>
          current?.id === nextSpace.id ? nextSpace : current,
        );
      },
      createSpace: async (name) => {
        if (!user) throw new Error("Sign in again to create a shared space.");
        if (creatingSpaceRef.current) return;
        const spaceName = name.trim();
        if (!spaceName) throw new Error("Enter a name for your shared space.");
        creatingSpaceRef.current = true;
        const spaceId = crypto.randomUUID();
        const payload = { id: spaceId, name: spaceName, created_by: user.id };
        try {
          if (import.meta.env.DEV)
            console.info(
              "Supabase space creation request",
              JSON.stringify({
                authenticatedUserId: user.id,
                suppliedCreatedBy: payload.created_by,
              }),
            );
          const { error: spaceError, status } = await supabase
            .from("spaces")
            .insert(payload);
          if (spaceError) {
            if (import.meta.env.DEV)
              console.error(
                "Supabase space creation failed",
                JSON.stringify({
                  authenticatedUserId: user.id,
                  suppliedCreatedBy: payload.created_by,
                  code: spaceError.code,
                  message: spaceError.message,
                  details: spaceError.details,
                  hint: spaceError.hint,
                  status,
                }),
              );
            throw new Error(
              "We could not create your space. Please try again.",
            );
          }

          for (const delay of [0, 250, 600, 1200]) {
            if (delay) await wait(delay);
            const { data: membership, error: membershipError } = await supabase
              .from("space_members")
              .select("space_id, user_id, role, created_at")
              .eq("space_id", spaceId)
              .eq("user_id", user.id)
              .maybeSingle();
            if (membershipError)
              throw new Error(
                "Your space was created, but membership could not be confirmed. Try again.",
              );
            if (!membership) continue;

            const { data: space, error: loadError } = await supabase
              .from("spaces")
              .select("id, name, created_by")
              .eq("id", spaceId)
              .single();
            if (loadError || !space)
              throw new Error(
                "Your space was created, but could not be opened. Try again.",
              );
            const nextMembership: SpaceMembership = {
              spaceId: membership.space_id,
              userId: membership.user_id,
              role: membership.role as SpaceMembership["role"],
              createdAt: membership.created_at,
            };
            setMemberships((current) => [...current, nextMembership]);
            const nextSpace = {
              id: space.id,
              name: space.name,
              createdBy: space.created_by,
            };
            setSpaces((current) => [...current, nextSpace]);
            setActiveSpace(nextSpace);
            window.localStorage.setItem(
              `our-adventures:active-space:${user.id}`,
              nextSpace.id,
            );
            return;
          }
          throw new Error(
            "Your space was created, but membership is still being prepared. Try again shortly.",
          );
        } finally {
          creatingSpaceRef.current = false;
        }
      },
    }),
    [activeSpace, error, load, loading, memberships, profile, spaces, user],
  );

  return (
    <WorkspaceContext.Provider value={value}>
      {children}
    </WorkspaceContext.Provider>
  );
}

export function useWorkspace() {
  const context = useContext(WorkspaceContext);
  if (!context)
    throw new Error("useWorkspace must be used within WorkspaceProvider");
  return context;
}
