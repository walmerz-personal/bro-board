// "Frame their face": a square frame over the photo that finds the face by
// itself, then lets family drag and zoom to adjust before it is used.

import { useEffect, useRef, useState } from 'react';
import { centreSquare, panSquare, squareAroundFace, zoomSquare, type Square } from './crop';
import type { Photo } from './photo';

const VIEW = 300; // size of the preview square on screen, in CSS pixels

type Finding = 'looking' | 'found' | 'none';

export function CropDialog({
  image,
  name,
  onUse,
  onCancel,
}: {
  image: Photo;
  name: string;
  onUse: (square: Square) => void;
  onCancel: () => void;
}) {
  const W = image.width;
  const H = image.height;
  const [square, setSquare] = useState<Square>(() => centreSquare(W, H));
  const [finding, setFinding] = useState<Finding>('looking');
  const canvas = useRef<HTMLCanvasElement>(null);
  const drag = useRef<{ x: number; y: number } | null>(null);
  const touched = useRef(false);

  // Look for the face once, when the window opens.
  useEffect(() => {
    let cancelled = false;
    import('./face')
      .then(({ findFace }) => findFace(image))
      .then((face) => {
        if (cancelled) return;
        setFinding(face ? 'found' : 'none');
        // Don't move the frame if they already started adjusting it.
        if (face && !touched.current) setSquare(squareAroundFace(face, W, H));
      })
      .catch(() => !cancelled && setFinding('none'));
    return () => {
      cancelled = true;
    };
  }, [image, W, H]);

  // Draw the framed part of the photo.
  useEffect(() => {
    const el = canvas.current;
    if (!el) return;
    const ratio = window.devicePixelRatio || 1;
    el.width = VIEW * ratio;
    el.height = VIEW * ratio;
    const ctx = el.getContext('2d')!;
    ctx.imageSmoothingQuality = 'high';
    const half = square.size / 2;
    ctx.drawImage(image, square.cx - half, square.cy - half, square.size, square.size, 0, 0, el.width, el.height);
  }, [image, square]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onCancel();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onCancel]);

  const adjust = (next: Square) => {
    touched.current = true;
    setSquare(next);
  };
  const zoom = (factor: number) => adjust(zoomSquare(square, factor, W, H));
  const fullSize = Math.min(W, H);
  // Slider: 0 = whole photo, 100 = closest zoom.
  const closest = Math.min(48, fullSize);
  const sliderValue =
    fullSize > closest ? Math.round((100 * Math.log(square.size / fullSize)) / Math.log(closest / fullSize)) : 0;

  return (
    <div className="ed-modal" role="dialog" aria-label="Frame their face" onClick={onCancel}>
      <div className="ed-modal-box ed-crop" onClick={(e) => e.stopPropagation()}>
        <div className="ed-modal-head">
          <h3>Frame {name ? `${name}'s` : 'their'} face</h3>
          <button onClick={onCancel}>Cancel</button>
        </div>
        <div className="ed-crop-body">
          <p className={`ed-crop-status is-${finding}`} aria-live="polite">
            {finding === 'looking'
              ? 'Finding the face…'
              : finding === 'found'
                ? 'Found the face. Drag the photo or zoom to adjust, then press Use this photo.'
                : "Couldn't find a face. Drag the photo and zoom to frame it yourself."}
          </p>
          <div className="ed-crop-stage">
            <canvas
              ref={canvas}
              className="ed-crop-canvas"
              style={{ width: VIEW, height: VIEW }}
              tabIndex={0}
              aria-label="The photo as it will look. Drag, or use the arrow keys, to move it."
              onPointerDown={(e) => {
                e.currentTarget.setPointerCapture(e.pointerId);
                drag.current = { x: e.clientX, y: e.clientY };
              }}
              onPointerMove={(e) => {
                if (!drag.current) return;
                const dx = e.clientX - drag.current.x;
                const dy = e.clientY - drag.current.y;
                drag.current = { x: e.clientX, y: e.clientY };
                adjust(panSquare(square, dx, dy, VIEW, W, H));
              }}
              onPointerUp={() => (drag.current = null)}
              onPointerCancel={() => (drag.current = null)}
              onWheel={(e) => zoom(e.deltaY > 0 ? 1.08 : 1 / 1.08)}
              onKeyDown={(e) => {
                const step = 12;
                const moves: Record<string, [number, number]> = {
                  ArrowLeft: [step, 0],
                  ArrowRight: [-step, 0],
                  ArrowUp: [0, step],
                  ArrowDown: [0, -step],
                };
                if (moves[e.key]) {
                  e.preventDefault();
                  adjust(panSquare(square, moves[e.key][0], moves[e.key][1], VIEW, W, H));
                } else if (e.key === '+' || e.key === '=') zoom(1 / 1.15);
                else if (e.key === '-') zoom(1.15);
              }}
            />
            <span className="ed-crop-ring" aria-hidden="true" />
          </div>
          <div className="ed-crop-zoom">
            <button onClick={() => zoom(1.15)} aria-label="Zoom out">
              −
            </button>
            <input
              type="range"
              min={0}
              max={100}
              value={Math.min(100, Math.max(0, sliderValue))}
              aria-label="Zoom"
              onChange={(e) => {
                const t = Number(e.target.value) / 100;
                const size = fullSize * Math.pow(closest / fullSize, t);
                adjust(zoomSquare(square, size / square.size, W, H));
              }}
            />
            <button onClick={() => zoom(1 / 1.15)} aria-label="Zoom in">
              +
            </button>
          </div>
        </div>
        <div className="ed-crop-foot">
          <button onClick={() => adjust(centreSquare(W, H))}>Show whole photo</button>
          <button className="ed-primary" onClick={() => onUse(square)}>
            Use this photo
          </button>
        </div>
      </div>
    </div>
  );
}
