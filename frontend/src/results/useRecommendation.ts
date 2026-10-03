import { useCallback, useEffect, useRef, useState } from 'react';

import { getTravelAgent } from '../agent';
import type { TripModifier, TripRecommendation } from '../agent';
import type { TripPreferences } from '../planner/types';

export type RecommendationStatus = 'analyzing' | 'ready' | 'error';

interface UseRecommendationResult {
  status: RecommendationStatus;
  recommendation: TripRecommendation | null;
  error: string | null;
  /** A short, rotating line describing what the "agent" is doing, for the analyzing state. */
  analyzingLabel: string;
  regenerate: () => void;
  applyModifier: (modifier: TripModifier) => void;
}

/**
 * Owns the recommendation lifecycle for the results page: it asks the active TravelAgent
 * to generate a trip from the student's preferences, holds the result, and exposes
 * regenerate + modifier actions.
 *
 * A brief, deliberate "analyzing" phase makes the generation feel considered (like an
 * agent working) rather than instantaneous. It's purely cosmetic and respects reduced
 * motion by keeping the delay short and non-essential — the data is ready either way.
 */
export function useRecommendation(prefs: TripPreferences): UseRecommendationResult {
  const agent = getTravelAgent();
  const [status, setStatus] = useState<RecommendationStatus>('analyzing');
  const [recommendation, setRecommendation] = useState<TripRecommendation | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [analyzingLabel, setAnalyzingLabel] = useState(ANALYZING_STEPS[0]);

  // Guards against setting state after unmount / stale async resolves.
  const runIdRef = useRef(0);
  const timersRef = useRef<ReturnType<typeof setTimeout>[]>([]);

  const clearTimers = () => {
    timersRef.current.forEach(clearTimeout);
    timersRef.current = [];
  };

  const run = useCallback(
    async (produce: () => Promise<TripRecommendation>) => {
      const myRun = ++runIdRef.current;
      clearTimers();
      setStatus('analyzing');
      setError(null);

      // Rotate the analyzing captions for a sense of progress.
      ANALYZING_STEPS.forEach((label, i) => {
        const t = setTimeout(() => {
          if (runIdRef.current === myRun) setAnalyzingLabel(label);
        }, i * 450);
        timersRef.current.push(t);
      });

      try {
        const result = await produce();
        // Keep the analyzing phase visible briefly even if generation is instant.
        const t = setTimeout(() => {
          if (runIdRef.current !== myRun) return;
          setRecommendation(result);
          setStatus('ready');
        }, Math.min(ANALYZING_STEPS.length * 450, 1400));
        timersRef.current.push(t);
      } catch (err) {
        if (runIdRef.current !== myRun) return;
        setError(err instanceof Error ? err.message : 'Could not build your trip.');
        setStatus('error');
      }
    },
    [],
  );

  // Initial generation (and whenever the preferences object identity changes).
  useEffect(() => {
    run(() => agent.generateTrip(prefs));
    return clearTimers;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs]);

  const regenerate = useCallback(() => {
    run(() =>
      recommendation
        ? agent.applyModifier(prefs, recommendation, 'regenerate')
        : agent.generateTrip(prefs),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefs, recommendation, run]);

  const applyModifier = useCallback(
    (modifier: TripModifier) => {
      if (!recommendation) return;
      run(() => agent.applyModifier(prefs, recommendation, modifier));
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [prefs, recommendation, run],
  );

  return { status, recommendation, error, analyzingLabel, regenerate, applyModifier };
}

const ANALYZING_STEPS = [
  'Reading your preferences…',
  'Scanning destinations…',
  'Checking your budget…',
  'Planning each day…',
  'Finishing your trip…',
];
