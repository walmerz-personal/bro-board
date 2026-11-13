// Finding a face in a photo, entirely on this computer. Only loaded on the
// editor page, the first time someone frames a photo. The small model file is
// part of the app; the engine is downloaded once from a public code library.

import type { Box } from './crop';

const VERSION = '1.2.3';
const ENGINE = `https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@${VERSION}/wasm`;
const MODEL = `${import.meta.env.BASE_URL}models/blaze_face_short_range.tflite`;
/** Big photos are shrunk to this size before looking, which is quicker and works as well. */
const LOOK_SIZE = 640;

type Detector = { detect(image: HTMLCanvasElement): { detections: { boundingBox?: { originX: number; originY: number; width: number; height: number } }[] } };
let detector: Promise<Detector> | null = null;

function loadDetector(): Promise<Detector> {
  detector ??= (async () => {
    const { FaceDetector, FilesetResolver } = await import('@mediapipe/tasks-vision');
    const files = await FilesetResolver.forVisionTasks(ENGINE);
    return (await FaceDetector.createFromOptions(files, {
      baseOptions: { modelAssetPath: MODEL, delegate: 'CPU' },
      runningMode: 'IMAGE',
      minDetectionConfidence: 0.45,
    })) as unknown as Detector;
  })().catch((error: unknown) => {
    detector = null; // Let the next photo try again.
    throw error;
  });
  return detector;
}

/** The biggest face in the photo, in the photo's own pixels, or null if none was found. */
export async function findFace(image: CanvasImageSource & { width: number; height: number }): Promise<Box | null> {
  const scale = Math.min(1, LOOK_SIZE / Math.max(image.width, image.height));
  const canvas = document.createElement('canvas');
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext('2d')!.drawImage(image, 0, 0, canvas.width, canvas.height);
  const found = (await loadDetector()).detect(canvas).detections;
  let best: Box | null = null;
  for (const d of found) {
    const b = d.boundingBox;
    if (!b) continue;
    const box = { x: b.originX / scale, y: b.originY / scale, width: b.width / scale, height: b.height / scale };
    if (!best || box.width * box.height > best.width * best.height) best = box;
  }
  return best;
}
