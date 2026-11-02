import { createContext, type ReactNode } from 'react';

/** Whether the reader turned on «Менше руху» in the app's Settings. */
export const ReduceMotionSettingContext = createContext(false);

/**
 * Gives every animation below the reader's «Менше руху» choice. It joins the
 * system's Reduce Motion: either one turns every animation into its calmer
 * variant (ADR 0055).
 */
export function ReduceMotionProvider({
  reduceMotion,
  children,
}: {
  reduceMotion: boolean;
  children: ReactNode;
}) {
  return <ReduceMotionSettingContext value={reduceMotion}>{children}</ReduceMotionSettingContext>;
}
