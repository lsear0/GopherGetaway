// Ambient types for the existing plain-JSX AccessibilityContext, so TypeScript code
// (the new /plan feature) can consume it with full typing without converting the
// original file.

import type { ReactNode } from 'react';

export type ThemeId = 'default' | 'deuteranopia' | 'protanopia' | 'tritanopia';
export type TextSizeId = 'normal' | 'large' | 'xlarge';

export interface AccessibilityOption<T extends string> {
  id: T;
  label: string;
}

export const THEMES: ReadonlyArray<AccessibilityOption<ThemeId>>;
export const TEXT_SIZES: ReadonlyArray<AccessibilityOption<TextSizeId>>;

export interface AccessibilityValue {
  theme: ThemeId;
  textSize: TextSizeId;
  highContrast: boolean;
  setTheme: (theme: ThemeId) => void;
  setTextSize: (textSize: TextSizeId) => void;
  toggleHighContrast: () => void;
}

export function AccessibilityProvider(props: { children: ReactNode }): JSX.Element;
export function useAccessibility(): AccessibilityValue;
