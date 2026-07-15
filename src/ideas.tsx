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
import {
  createIdea,
  deleteIdea as deleteIdeaRecord,
  loadIdeas,
  updateIdea,
  updateIdeaStatus,
  type IdeaDraft,
} from "./repositories/ideas";
import type { Idea, IdeaStatus } from "./types";
import { useWorkspace } from "./workspace";

type IdeasState = {
  ideas: Idea[];
  loading: boolean;
  error: string | null;
  retry: () => Promise<void>;
  saveIdea: (idea: Idea) => Promise<void>;
  setIdeaStatus: (id: string, status: IdeaStatus) => Promise<void>;
  deleteIdea: (id: string) => Promise<void>;
};

const IdeasContext = createContext<IdeasState | null>(null);

function toDraft(idea: Idea): IdeaDraft {
  return {
    title: idea.title,
    description: idea.description,
    category: idea.category,
    status: idea.status,
    tags: idea.tags,
    optionalLink: idea.optionalLink,
    optionalImage: idea.optionalImage,
    coverPresetId: idea.coverPresetId ?? null,
    optionalLocation: idea.optionalLocation,
    isDateNight: idea.isDateNight,
  };
}

export function IdeasProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { activeSpace } = useWorkspace();
  const [ideas, setIdeas] = useState<Idea[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const savingRef = useRef(false);

  const load = useCallback(async () => {
    if (!activeSpace) return;
    setLoading(true);
    setError(null);
    try {
      setIdeas(await loadIdeas(activeSpace.id));
    } catch (nextError) {
      setIdeas([]);
      setError(
        nextError instanceof Error
          ? nextError.message
          : "We could not load your ideas. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }, [activeSpace]);

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => void load());
    return () => window.cancelAnimationFrame(frame);
  }, [load]);

  const value = useMemo<IdeasState>(
    () => ({
      ideas,
      loading,
      error,
      retry: load,
      saveIdea: async (idea) => {
        if (!user || !activeSpace)
          throw new Error("Open your shared space and try again.");
        if (savingRef.current) return;
        savingRef.current = true;
        try {
          const saved = idea.id
            ? await updateIdea(activeSpace.id, idea.id, toDraft(idea))
            : await createIdea(activeSpace.id, user.id, toDraft(idea));
          setIdeas((current) =>
            idea.id
              ? current.map((item) => (item.id === saved.id ? saved : item))
              : [saved, ...current],
          );
        } finally {
          savingRef.current = false;
        }
      },
      setIdeaStatus: async (id, status) => {
        if (!activeSpace)
          throw new Error("Open your shared space and try again.");
        const saved = await updateIdeaStatus(activeSpace.id, id, status);
        setIdeas((current) =>
          current.map((item) => (item.id === saved.id ? saved : item)),
        );
      },
      deleteIdea: async (id) => {
        if (!activeSpace)
          throw new Error("Open your shared space and try again.");
        await deleteIdeaRecord(activeSpace.id, id);
        setIdeas((current) => current.filter((item) => item.id !== id));
      },
    }),
    [activeSpace, error, ideas, load, loading, user],
  );

  return (
    <IdeasContext.Provider value={value}>{children}</IdeasContext.Provider>
  );
}

export function useIdeas() {
  const context = useContext(IdeasContext);
  if (!context) throw new Error("useIdeas must be used within IdeasProvider");
  return context;
}
