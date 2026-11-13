import { describe, expect, it } from 'vitest';
import { centreSquare, clampSquare, panSquare, squareAroundFace, zoomSquare } from '../src/editor/crop';

describe('framing a photo', () => {
  it('starts with the biggest middle square', () => {
    expect(centreSquare(1200, 800)).toEqual({ cx: 600, cy: 400, size: 800 });
  });

  it('frames a found face with room for hair and chin, a little above centre', () => {
    const sq = squareAroundFace({ x: 500, y: 200, width: 100, height: 120 }, 1200, 800);
    expect(sq.size).toBeCloseTo(228);
    expect(sq.cx).toBe(550);
    expect(sq.cy).toBeCloseTo(245.6);
  });

  it('never lets the frame leave the photo', () => {
    const sq = squareAroundFace({ x: 0, y: 0, width: 300, height: 300 }, 1200, 800);
    expect(sq.cx - sq.size / 2).toBeGreaterThanOrEqual(0);
    expect(sq.cy - sq.size / 2).toBeGreaterThanOrEqual(0);
    expect(clampSquare({ cx: 5000, cy: 5000, size: 9000 }, 1200, 800)).toEqual({ cx: 800, cy: 400, size: 800 });
  });

  it('zooms around the same centre and stops at sensible limits', () => {
    const start = { cx: 600, cy: 400, size: 400 };
    expect(zoomSquare(start, 0.5, 1200, 800)).toEqual({ cx: 600, cy: 400, size: 200 });
    expect(zoomSquare(start, 0.001, 1200, 800).size).toBe(48);
    expect(zoomSquare(start, 10, 1200, 800).size).toBe(800);
  });

  it('moves the frame the opposite way to a drag, scaled to the photo', () => {
    // Dragging the shown photo 30 px right, where 300 px on screen = 600 px of photo.
    expect(panSquare({ cx: 600, cy: 400, size: 600 }, 30, 0, 300, 1200, 800)).toEqual({ cx: 540, cy: 400, size: 600 });
  });
});
