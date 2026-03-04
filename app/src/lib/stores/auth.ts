import { writable, derived } from 'svelte/store';
import type { User } from '$lib/types';

// ===== Current User =====
export const currentUser = writable<User | null>(null);
export const authToken = writable<string | null>(null);

// Derived: is logged in
export const isLoggedIn = derived(currentUser, ($user) => !!$user);

// Derived: auth provider
export const authProvider = derived(currentUser, ($user) => $user?.authProvider || null);

// ===== Mock user for development =====
export const MOCK_USER: User = {
  userId: 'usr-001',
  email: 'demo@griddoc.app',
  name: 'ผู้ใช้ตัวอย่าง',
  avatarUrl: '',
  authProvider: 'google',
  googleId: '123456789',
  driveFolderId: '',
  isActive: true,
  isAdmin: false,
  billingStatus: 'PAID',
  createdAt: '2025-01-01T00:00:00Z',
  updatedAt: '2025-02-24T00:00:00Z',
};

/** Initialize with mock user for dev */
export function initMockAuth() {
  currentUser.set(MOCK_USER);
  authToken.set('mock-jwt-token');
}

/** Clear auth state (logout) */
export function logout() {
  currentUser.set(null);
  authToken.set(null);
  if (typeof window !== 'undefined') {
    localStorage.removeItem('auth.token');
    localStorage.removeItem('auth.user');
  }
}

/** Persist auth to localStorage */
export function persistAuth(user: User, token: string) {
  currentUser.set(user);
  authToken.set(token);
  if (typeof window !== 'undefined') {
    localStorage.setItem('auth.token', token);
    localStorage.setItem('auth.user', JSON.stringify(user));
  }
}

/** Restore auth from localStorage */
export function restoreAuth(): boolean {
  if (typeof window === 'undefined') return false;
  const token = localStorage.getItem('auth.token');
  const userJson = localStorage.getItem('auth.user');
  if (token && userJson) {
    try {
      // Check if JWT is expired locally before restoring
      if (token !== 'mock-jwt-token' && isTokenExpired(token)) {
        console.log('[auth] Token expired locally, clearing auth');
        localStorage.removeItem('auth.token');
        localStorage.removeItem('auth.user');
        return false;
      }
      const user = JSON.parse(userJson) as User;
      currentUser.set(user);
      authToken.set(token);
      return true;
    } catch {
      return false;
    }
  }
  return false;
}

/** Check if a JWT token is expired by decoding the payload locally (no library needed) */
export function isTokenExpired(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return true;
    // Base64Url → Base64 → JSON
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = JSON.parse(atob(payload));
    if (!json.exp) return false; // no expiry claim = never expires
    // Add 60s buffer to avoid edge-case where token expires mid-request
    return json.exp < (Date.now() / 1000) + 60;
  } catch {
    return true; // if we can't decode, treat as expired
  }
}
