// Text that grows as large as it can while still fitting its box.

import { useLayoutEffect, useRef } from 'react';

export function FitText({ text, className }: { text: string; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const inner = useRef<HTMLSpanElement>(null);

  useLayoutEffect(() => {
    const boxEl = box.current;
    const innerEl = inner.current;
    if (!boxEl || !innerEl) return;

    const fit = () => {
      let low = 16;
      let high = 400;
      while (high - low > 1) {
        const mid = Math.floor((low + high) / 2);
        innerEl.style.fontSize = `${mid}px`;
        // scrollWidth grows when a single word is too wide, so words are never split.
        const fits = innerEl.scrollWidth <= boxEl.clientWidth && innerEl.offsetHeight <= boxEl.clientHeight;
        if (fits) low = mid;
        else high = mid;
      }
      innerEl.style.fontSize = `${low}px`;
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
