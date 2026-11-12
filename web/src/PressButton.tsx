// A button that ignores shaky double taps and, optionally, quick brushes.

import { createContext, useContext, useRef, type ReactNode } from 'react';
import { shouldAcceptPress, type Settings } from './board';

interface PressContextValue {
  settings: Pick<Settings, 'repeatDelayMs' | 'holdMs'>;
  /** Shared by every button, so a second tap anywhere is ignored. */
  lastAcceptedAt: { current: number | null };
}

export const PressContext = createContext<PressContextValue>({
  settings: { repeatDelayMs: 600, holdMs: 0 },
  lastAcceptedAt: { current: null },
});

interface Props {
  onPress: () => void;
  className?: string;
  disabled?: boolean;
  label?: string;
  children: ReactNode;
}

export function PressButton({ onPress, className, disabled, label, children }: Props) {
  const { settings, lastAcceptedAt } = useContext(PressContext);
  const downAt = useRef<number | null>(null);

  return (
    <button
      type="button"
      className={className}
      disabled={disabled}
      aria-label={label}
      onPointerDown={() => {
        downAt.current = performance.now();
      }}
      onPointerCancel={() => {
        downAt.current = null;
      }}
      // The browser only sends a click when the finger lifts on the same
      // button it went down on, so sliding off cancels the press.
      onClick={() => {
        const now = performance.now();
        const accepted = shouldAcceptPress(
          { now, lastAcceptedAt: lastAcceptedAt.current, downAt: downAt.current },
          settings,
        );
        downAt.current = null;
        if (!accepted) return;
        lastAcceptedAt.current = now;
        onPress();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
