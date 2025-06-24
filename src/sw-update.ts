import { registerSW } from 'virtual:pwa-register';

// Automatically refresh the page when a new service worker is installed
registerSW({
  onNeedRefresh() {
    // Force an immediate reload so the user always sees the latest version
    window.location.reload();
  },
});
