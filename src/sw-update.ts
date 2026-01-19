import { registerSW } from 'virtual:pwa-register';

if (import.meta.env.DEV) {
  // Safety net: ensure no stale SW survives in development.
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker
      .getRegistrations()
      .then((registrations) => Promise.all(registrations.map((r) => r.unregister())))
      .catch(() => {
        // Ignore failures
      });
  }
} else {
  // Automatically refresh the page when a new service worker is installed
  registerSW({
    onNeedRefresh() {
      // Force an immediate reload so the user always sees the latest version
      window.location.reload();
    },
  });
}
