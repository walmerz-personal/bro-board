// Photos family upload for people he can text. A person's picture is either
// a symbol name ("family") or "photo:<id>". The photo itself is stored with
// his board in Firebase and kept on his phone for offline use.

export const PHOTO_PREFIX = 'photo:';

export function isPhoto(icon: string): boolean {
  return icon.startsWith(PHOTO_PREFIX);
}

export function photoIdOf(icon: string): string {
  return icon.slice(PHOTO_PREFIX.length);
}

// Photos already on this device (id -> JPEG as base64), and who to tell when it changes.
let photos: Record<string, string> = {};
let version = 0;
const listeners = new Set<() => void>();

function changed() {
  version += 1;
  listeners.forEach((listener) => listener());
}

export function setPhotos(map: Record<string, string>): void {
  photos = map;
  changed();
}

export function addPhoto(id: string, base64: string): void {
  photos = { ...photos, [id]: base64 };
  changed();
}

export function hasPhoto(id: string): boolean {
  return !!photos[id];
}

/** For React's useSyncExternalStore, so pictures appear as soon as they download. */
export function subscribePhotos(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
export function photosVersion(): number {
  return version;
}

/**
 * Where to load a button's picture from. A photo not downloaded yet shows the
 * family picture until it arrives.
 */
export function pictureSrc(icon: string): string {
  if (isPhoto(icon)) {
    const data = photos[photoIdOf(icon)];
    if (data) return `data:image/jpeg;base64,${data}`;
    icon = 'family';
  }
  return `${import.meta.env.BASE_URL}symbols/${icon}.svg`;
}
