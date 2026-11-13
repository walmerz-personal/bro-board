// Keeping the app itself up to date (its code, not his buttons).
//
// The app is saved on the phone so it works offline. When a new version is
// published, it downloads in the background; the page then needs a reload to
// use it. A reload must never surprise him part-way through choosing
// something, so each screen says when it is safe:
// - his board: only on the first Home screen
// - the editor: only when there are no unsaved changes

import { registerSW } from 'virtual:pwa-register';

let ready = false;
let safe = false;
const CHECK_EVERY_MS = 60 * 60 * 1000;

function reloadIfReady() {
  if (ready && safe) window.location.reload();
}

registerSW({
  immediate: true,
  // The new version has taken over; reload as soon as it is safe.
  onNeedReload() {
    ready = true;
    reloadIfReady();
  },
  // Look for a new version when the app is reopened and every hour while open.
  onRegisteredSW(_url, registration) {
    if (!registration) return;
    const check = () => {
      if (navigator.onLine) void registration.update().catch(() => undefined);
    };
    window.setInterval(check, CHECK_EVERY_MS);
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') check();
    });
  },
});

/** Tell the updater whether a reload right now would interrupt anything. */
export function setSafeToReload(value: boolean): void {
  safe = value;
  reloadIfReady();
}
