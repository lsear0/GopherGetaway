import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';

import { createDefaultPreferences, type TripPreferences } from './types';
import { loadPreferences, savePreferences } from './plannerStorage';

/**
 * Holds the in-progress trip preferences for the whole /plan wizard.
 *
 * - Hydrates from localStorage on mount so answers survive reloads.
 * - Persists on every change (debounced via a microtask-free effect) so nothing is lost.
 * - Exposes a typed `update` that merges a partial patch, plus `reset`.
 *
 * Keeping this in context (not inside the wizard component) means each step component can
 * read/write only the slice it cares about without prop-drilling.
 */

interface PlannerContextValue {
  preferences: TripPreferences;
  /** Shallow-merge a partial patch into the preferences. */
  update: (patch: Partial<TripPreferences>) => void;
  /** Replace the whole object (used by nested updates that build a new slice). */
  set: (next: TripPreferences) => void;
  reset: () => void;
  /** True once a change has been made this session (used to warn before leaving). */
  dirty: boolean;
}

const PlannerContext = createContext<PlannerContextValue | null>(null);

export function PlannerProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState<TripPreferences>(() => loadPreferences());
  const dirtyRef = useRef(false);
  const [dirty, setDirty] = useState(false);

  // Persist whenever preferences change.
  useEffect(() => {
    savePreferences(preferences);
  }, [preferences]);

  const update = useCallback((patch: Partial<TripPreferences>) => {
    setPreferences((prev) => ({ ...prev, ...patch }));
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setDirty(true);
    }
  }, []);

  const set = useCallback((next: TripPreferences) => {
    setPreferences(next);
    if (!dirtyRef.current) {
      dirtyRef.current = true;
      setDirty(true);
    }
  }, []);

  const reset = useCallback(() => {
    setPreferences(createDefaultPreferences());
    dirtyRef.current = false;
    setDirty(false);
  }, []);

  const value = useMemo<PlannerContextValue>(
    () => ({ preferences, update, set, reset, dirty }),
    [preferences, update, set, reset, dirty],
  );

  return <PlannerContext.Provider value={value}>{children}</PlannerContext.Provider>;
}

export function usePlanner(): PlannerContextValue {
  const ctx = useContext(PlannerContext);
  if (!ctx) {
    throw new Error('usePlanner must be used within a PlannerProvider');
  }
  return ctx;
}
