/**
 * Common props every step component receives from the wizard. The wizard owns navigation
 * and validation state; steps only render their question and wire inputs to the planner
 * context.
 */
export interface StepComponentProps {
  /** Current validation message for this step (null when valid / not yet attempted). */
  error: string | null;
  onBack?: () => void;
  onNext: () => void;
  isFirst?: boolean;
  isLast?: boolean;
}
