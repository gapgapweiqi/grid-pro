/**
 * Platform detection utilities.
 * Detects whether the app is running inside Tauri, as a PWA standalone, or in a browser.
 */

/** Check if running inside a Tauri desktop app */
export function isTauri(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    '__TAURI_INTERNALS__' in window ||
    window.location.protocol === 'tauri:' ||
    window.location.hostname === 'tauri.localhost' ||
    navigator.userAgent.includes('Tauri')
  );
}

/** Check if running as an installed PWA (standalone mode) */
export function isPwaStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    ('standalone' in window.navigator && (window.navigator as any).standalone === true)
  );
}

/** Check if running on iOS */
export function isIOSDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iphone|ipad|ipod/i.test(navigator.userAgent);
}

/** Check if running on Android */
export function isAndroidDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /android/i.test(navigator.userAgent);
}

/** Check if running on macOS */
export function isMacOS(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /macintosh|mac os x/i.test(navigator.userAgent);
}

/** Check if running on Windows */
export function isWindows(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /windows/i.test(navigator.userAgent);
}

export type PlatformType = 'tauri' | 'pwa' | 'browser';

/** Get the current platform type */
export function getPlatform(): PlatformType {
  if (isTauri()) return 'tauri';
  if (isPwaStandalone()) return 'pwa';
  return 'browser';
}
