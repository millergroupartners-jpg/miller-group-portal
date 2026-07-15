import { useSyncExternalStore } from 'react';

/**
 * PWA install-prompt plumbing. `beforeinstallprompt` can fire before React
 * mounts, so the capture lives at MODULE scope — main.tsx imports this file
 * for its side effect to guarantee the listener registers early.
 */

let deferredPrompt: any = null; // BeforeInstallPromptEvent (no lib.dom type)
const listeners = new Set<() => void>();
const notify = () => listeners.forEach(fn => fn());

if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt = e;
    notify();
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    notify();
  });
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

function isStandaloneNow(): boolean {
  return window.matchMedia('(display-mode: standalone)').matches
    || (navigator as any).standalone === true; // iOS Safari
}

function isIOSDevice(): boolean {
  const ua = navigator.userAgent;
  return /iphone|ipad|ipod/i.test(ua)
    || (/macintosh/i.test(ua) && navigator.maxTouchPoints > 1); // iPadOS
}

export function useInstallPrompt(): {
  isStandalone: boolean;
  canPrompt: boolean;
  isIOS: boolean;
  promptInstall: () => Promise<void>;
} {
  const canPrompt = useSyncExternalStore(subscribe, () => deferredPrompt !== null);
  return {
    isStandalone: isStandaloneNow(),
    canPrompt,
    isIOS: isIOSDevice(),
    promptInstall: async () => {
      if (!deferredPrompt) return;
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => {});
      deferredPrompt = null;
      notify();
    },
  };
}
