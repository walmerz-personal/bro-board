// Text that grows as large as it can while still fitting its box.

import { useLayoutEffect, useRef } from 'react';

export function FitText({ text, className }: { text: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const boxEl = box.current;
    const innerEl = inner.current;
    if (!boxEl || !innerEl) return;

    const fitsAt = (size: number) => {
      innerEl.style.fontSize = `${size}px`;
      // scrollWidth grows when a single word is too wide, so words are never split.
      return innerEl.scrollWidth <= boxEl.clientWidth && innerEl.offsetHeight <= boxEl.clientHeight;
    };
    const linesAt = (size: number) => {
      innerEl.style.fontSize = `${size}px`;
      return Math.round(innerEl.offsetHeight / (size * 1.12));
    };

    const fit = () => {
      let low = 16;
      let high = 400;
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        if (fitsAt(mid)) low = mid;
        else high = mid;
      }
      // The largest size often leaves one word per line ("I / would / like").
      // Allow a slightly smaller size if it reads in fewer, fuller lines.
      let best = low;
      let bestLines = linesAt(low);
      for (let size = low - 2; size >= Math.floor(low * 0.78); size -= 2) {
        const lines = linesAt(size);
        if (lines < bestLines) {
          best = size;
          bestLines = lines;
        }
      }
      innerEl.style.fontSize = `${best}px`;
    };

    fit();
    const observer = new ResizeObserver(fit);
    observer.observe(boxEl);
    return () => observer.disconnect();
  }, [text]);

  return (
    <div ref={box} className={className}>
      <span ref={inner} className="fit-text-inner">
        {text}
      </span>
    </div>
  );
}
