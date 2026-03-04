/**
 * Shared PWA Install Store
 * Captures beforeinstallprompt event and provides install state for all components.
 */
import { writable, get } from 'svelte/store';
import { isTauri } from '$lib/utils/platform';

// --- State ---
export const deferredPrompt = writable<any>(null);
export const canInstall = writable(false);
export const isStandalone = writable(false);
export const isIOS = writable(false);
export const isInstalled = writable(false);
export const isTauriApp = writable(false);

let _initialized = false;

/** Initialize PWA install listeners (call once from root layout) */
export function initPwaInstall() {
  if (_initialized || typeof window === 'undefined') return;
  _initialized = true;

  // Detect Tauri — skip all PWA install logic when running as native desktop app
  if (isTauri()) {
    isTauriApp.set(true);
    isInstalled.set(true); // treat as "installed" so no prompts show
    return;
  }

  // Detect iOS
  const ua = window.navigator.userAgent.toLowerCase();
  const ios = /iphone|ipad|ipod/.test(ua);
  isIOS.set(ios);

  // Detect standalone mode (already installed)
  const standalone =
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as any).standalone === true);
  isStandalone.set(standalone);
  isInstalled.set(standalone);

  // Listen for beforeinstallprompt (Android / Desktop Chrome)
  window.addEventListener('beforeinstallprompt', (e: Event) => {
    e.preventDefault();
    deferredPrompt.set(e);
    canInstall.set(true);
  });

  // Listen for appinstalled
  window.addEventListener('appinstalled', () => {
    isInstalled.set(true);
    canInstall.set(false);
    deferredPrompt.set(null);
  });
}

/** Trigger the native install prompt */
export async function triggerInstall(): Promise<'accepted' | 'dismissed' | null> {
  const prompt = get(deferredPrompt);
  if (!prompt) return null;

  prompt.prompt();
  const { outcome } = await prompt.userChoice;

  if (outcome === 'accepted') {
    isInstalled.set(true);
  }
  deferredPrompt.set(null);
  canInstall.set(false);

  return outcome;
}
