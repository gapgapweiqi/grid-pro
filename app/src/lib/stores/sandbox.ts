/**
 * Sandbox Store — manages sandbox mode for non-login users.
 * Provides global isSandbox flag, constants, and init/exit functions.
 *
 * IMPORTANT: initSandbox() saves any existing real auth before overwriting
 * with mock data. exitSandbox() restores real auth if it was saved, so
 * a logged-in user who visits sandbox won't lose their session.
 */
import { writable, get } from 'svelte/store';
import { initMockAuth, logout, currentUser, authToken, persistAuth } from './auth';
import type { User } from '$lib/types';

// ===== Sandbox State =====
export const isSandbox = writable<boolean>(false);

// ===== Constants =====
export const SANDBOX_COMPANY_ID = 'comp-001';
export const SANDBOX_LOCKED_PRODUCT_ID = 'sandbox-prod-gridpro';
export const SANDBOX_LOGO_URL = '/gridpro-logo.jpg';

// Stash for real auth while sandbox is active
let _savedRealUser: User | null = null;
let _savedRealToken: string | null = null;

/** Initialize sandbox mode */
export function initSandbox() {
  // Save real auth in memory so exitSandbox can restore it
  const token = typeof window !== 'undefined' ? localStorage.getItem('auth.token') : null;
  if (token && token !== 'mock-jwt-token') {
    _savedRealToken = token;
    const userJson = typeof window !== 'undefined' ? localStorage.getItem('auth.user') : null;
    if (userJson) {
      try { _savedRealUser = JSON.parse(userJson); } catch { _savedRealUser = null; }
    }
  }

  isSandbox.set(true);
  if (typeof window !== 'undefined') {
    sessionStorage.setItem('sandbox', '1');
  }
  initMockAuth();
}

/** Exit sandbox mode and clean up */
export function exitSandbox() {
  isSandbox.set(false);
  if (typeof window !== 'undefined') {
    sessionStorage.removeItem('sandbox');
  }

  // If we stashed a real user before entering sandbox, restore it instead of full logout
  if (_savedRealUser && _savedRealToken) {
    persistAuth(_savedRealUser, _savedRealToken);
    _savedRealUser = null;
    _savedRealToken = null;
  } else {
    // No real auth to restore — clear mock auth from stores only (not localStorage)
    currentUser.set(null);
    authToken.set(null);
  }
}

/** Restore sandbox flag from sessionStorage (called on app bootstrap) */
export function restoreSandbox(): boolean {
  if (typeof window === 'undefined') return false;
  const flag = sessionStorage.getItem('sandbox');
  if (flag === '1') {
    isSandbox.set(true);
    return true;
  }
  return false;
}
