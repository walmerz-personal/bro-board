// Turns a photo family pick into a small square JPEG for his buttons.

import type { Square } from './crop';

/** Size of the stored photo, in pixels. Big enough to look sharp on his tiles. */
const SIZE = 360;

export type Photo = ImageBitmap | HTMLImageElement;

/** Cut the chosen square out of the photo, shrink it, and return JPEG bytes (about 12-40 KB). */
export async function cropToJpeg(image: Photo, square: Square): Promise<Uint8Array> {
  const canvas = document.createElement('canvas');
  canvas.width = SIZE;
  canvas.height = SIZE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('This browser cannot resize photos');
  ctx.imageSmoothingQuality = 'high';
  const half = square.size / 2;
  ctx.drawImage(image, square.cx - half, square.cy - half, square.size, square.size, 0, 0, SIZE, SIZE);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.85));
  if (!blob) throw new Error('Could not make the photo smaller');
  return new Uint8Array(await blob.arrayBuffer());
}

/** Thrown when the browser cannot read the photo, for example Apple's HEIC format in Chrome. */
export class UnreadablePhoto extends Error {
  constructor(readonly heic: boolean) {
    super('This photo could not be opened');
  }
}

/**
 * Open the photo. The quick way works for JPEG and PNG everywhere; the second
 * way lets Safari open iPhone (HEIC) photos too.
 */
export async function openImage(file: File): Promise<Photo> {
  const heic = /hei[cf]/i.test(file.type) || /\.hei[cf]$/i.test(file.name);
  if (file.type && !file.type.startsWith('image/')) throw new UnreadablePhoto(false);
  try {
    return await createImageBitmap(file, { imageOrientation: 'from-image' });
  } catch {
    const url = URL.createObjectURL(file);
    try {
      const img = new Image();
      img.src = url;
      await img.decode();
      return img;
    } catch {
      throw new UnreadablePhoto(heic);
    } finally {
      URL.revokeObjectURL(url);
    }
  }
}

/** A long random id for a stored photo. */
export function newPhotoId(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(15));
  return 'p' + btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_');
}

export function toBase64(bytes: Uint8Array): string {
  let text = '';
  for (let i = 0; i < bytes.length; i += 0x8000) text += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(text);
}
