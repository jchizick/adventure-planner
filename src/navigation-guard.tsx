import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
} from "react";
import { useBeforeUnload, useBlocker } from "react-router-dom";
import { ConfirmationDialog } from "./components";

export type UnsavedChangesGuard = {
  isDirty: () => boolean;
  discard: () => void;
};

type RegisterGuard = (guard: UnsavedChangesGuard | null) => () => void;
const GuardContext = createContext<RegisterGuard>(() => () => undefined);

export function NavigationGuardProvider({ children }: { children: ReactNode }) {
  const guardRef = useRef<UnsavedChangesGuard | null>(null);
  const register = useCallback<RegisterGuard>((guard) => {
    guardRef.current = guard;
    return () => {
      if (guardRef.current === guard) guardRef.current = null;
    };
  }, []);
  const blocker = useBlocker(({ currentLocation, nextLocation }) =>
    Boolean(
      guardRef.current?.isDirty() &&
      (currentLocation.pathname !== nextLocation.pathname ||
        currentLocation.search !== nextLocation.search ||
        currentLocation.hash !== nextLocation.hash),
    ),
  );

  useBeforeUnload(
    useCallback((event) => {
      if (!guardRef.current?.isDirty()) return;
      event.preventDefault();
      event.returnValue = "";
    }, []),
  );

  return (
    <GuardContext.Provider value={register}>
      {children}
      <ConfirmationDialog
        open={blocker.state === "blocked"}
        title="Discard unsaved changes?"
        body="Your changes have not been saved."
        cancelLabel="Keep editing"
        confirmLabel="Discard changes"
        pendingLabel="Discarding…"
        onCancel={() => blocker.reset?.()}
        onConfirm={() => {
          guardRef.current?.discard();
          blocker.proceed?.();
        }}
      />
    </GuardContext.Provider>
  );
}

export function useUnsavedChangesGuard(guard: UnsavedChangesGuard | null) {
  const register = useContext(GuardContext);
  useEffect(() => register(guard), [guard, register]);
}
