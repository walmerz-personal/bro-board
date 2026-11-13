// Framing a person's photo: a square region of the original picture.
// Kept as plain maths so it is easy to test.

export interface Square {
  /** Centre of the square, in the photo's own pixels. */
  cx: number;
  cy: number;
  /** Width (and height) of the square, in the photo's own pixels. */
  size: number;
}

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Smallest square allowed, so zooming in never shows just a few pixels. */
export const MIN_SIZE = 48;

/** Keep the square inside the photo and within sensible sizes. */
export function clampSquare(sq: Square, width: number, height: number): Square {
  const size = Math.min(Math.max(sq.size, Math.min(MIN_SIZE, width, height)), Math.min(width, height));
  const half = size / 2;
  return {
    size,
    cx: Math.min(Math.max(sq.cx, half), width - half),
    cy: Math.min(Math.max(sq.cy, half), height - half),
  };
}

/** The whole middle of the photo: where framing starts when no face is found. */
export function centreSquare(width: number, height: number): Square {
  return { cx: width / 2, cy: height / 2, size: Math.min(width, height) };
}

/**
 * A square around a found face, with room for hair and chin. A face detector's
 * box covers roughly eyebrows to mouth, so widen it and nudge it up a little.
 */
export function squareAroundFace(face: Box, width: number, height: number): Square {
  const side = Math.max(face.width, face.height) * 1.9;
  return clampSquare(
    { cx: face.x + face.width / 2, cy: face.y + face.height / 2 - face.height * 0.12, size: side },
    width,
    height,
  );
}

/** Zoom in (factor below 1) or out (above 1), keeping the same centre. */
export function zoomSquare(sq: Square, factor: number, width: number, height: number): Square {
  return clampSquare({ ...sq, size: sq.size * factor }, width, height);
}

/** Move the square by a distance measured on screen, where the square is shown `shown` pixels wide. */
export function panSquare(sq: Square, dxScreen: number, dyScreen: number, shown: number, width: number, height: number) {
  const scale = sq.size / shown;
  // Dragging the photo right moves the frame left over it.
  return clampSquare({ ...sq, cx: sq.cx - dxScreen * scale, cy: sq.cy - dyScreen * scale }, width, height);
}
