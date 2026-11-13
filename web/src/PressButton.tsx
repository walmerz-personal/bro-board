// A button that ignores shaky double taps and, optionally, quick brushes.

import { createContext, useContext, useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { shouldAcceptPress, type Settings } from './board';

interface PressContextValue {
  settings: Pick<Settings, 'repeatDelayMs' | 'holdMs' | 'vibrate'>;
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
  style?: CSSProperties;
  children: ReactNode;
}

/** How long a counted press stays visibly pressed after the finger lifts. */
const SHOW_PRESSED_MS = 280;

export function PressButton({ onPress, className, disabled, label, style, children }: Props) {
  const { settings, lastAcceptedAt } = useContext(PressContext);
  const downAt = useRef<number | null>(null);
  // The pressed look is under his finger while it is down, so keep it showing
  // for a moment afterwards: that is the "it counted" signal.
  const [shown, setShown] = useState(false);
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => () => window.clearTimeout(timer.current), []);

  return (
    <button
      type="button"
      className={shown ? `${className ?? ''} is-pressed` : className}
      style={style}
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
        setShown(true);
        window.clearTimeout(timer.current);
        timer.current = window.setTimeout(() => setShown(false), SHOW_PRESSED_MS);
        // A short buzz on phones that can, so he feels the press counted.
        if (settings.vibrate !== false) {
          try {
            navigator.vibrate?.(18);
          } catch {
            // Not allowed here. The visible feedback is enough.
          }
        }
        onPress();
      }}
      onContextMenu={(e) => e.preventDefault()}
    >
      {children}
    </button>
  );
}
