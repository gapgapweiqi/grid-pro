import { writable, derived } from 'svelte/store';
import type { Toast, Company } from '$lib/types';
import { THEME_OPTIONS, FONT_OPTIONS, DEFAULT_SETTINGS } from '$lib/config/constants';
import { hexToRgba } from '$lib/utils/helpers';

// ===== Sidebar =====
export const sidebarCollapsed = writable(false);
export const sidebarMobileOpen = writable(false);

export function toggleSidebar() {
  if (typeof window !== 'undefined' && window.innerWidth <= 1024) {
    sidebarMobileOpen.update(v => !v);
  } else {
    sidebarCollapsed.update(v => !v);
  }
}

export function closeMobileSidebar() {
  sidebarMobileOpen.set(false);
}

// ===== Company Switcher =====
export const companies = writable<Company[]>([]);
export const currentCompanyId = writable<string>('');

export const currentCompany = derived(
  [companies, currentCompanyId],
  ([$companies, $id]) => $id === '__all__' ? null : ($companies.find(c => c.entityId === $id) || $companies[0] || null)
);

/** Whether "all companies" is selected */
export const isAllCompanies = derived(currentCompanyId, ($id) => $id === '__all__');

/** Get array of company IDs to query — all companies when __all__, or single */
export const activeCompanyIds = derived(
  [companies, currentCompanyId],
  ([$companies, $id]) => $id === '__all__' ? $companies.map(c => c.entityId) : [$id || $companies[0]?.entityId || '']
);

// ===== Theme & Font =====
export const currentThemeId = writable<string>(DEFAULT_SETTINGS.theme);
export const currentFontId = writable<string>(DEFAULT_SETTINGS.font);

export function applyTheme(themeId: string) {
  currentThemeId.set(themeId);
  if (typeof document === 'undefined') return;
  const theme = THEME_OPTIONS.find(t => t.id === themeId) || THEME_OPTIONS[0];
  if (!theme) return;
  document.documentElement.style.setProperty('--color-primary', theme.value);
  document.documentElement.style.setProperty('--color-primary-soft', hexToRgba(theme.value, 0.12));
  document.documentElement.style.setProperty('--color-primary-hover', hexToRgba(theme.value, 0.85));
  document.documentElement.style.setProperty('--color-accent', theme.value);
  document.documentElement.style.setProperty('--color-accent-soft', hexToRgba(theme.value, 0.12));
}

export function applyFont(fontId: string) {
  currentFontId.set(fontId);
  if (typeof document === 'undefined') return;
  const font = FONT_OPTIONS.find(f => f.id === fontId) || FONT_OPTIONS[0];
  if (!font) return;
  document.documentElement.style.setProperty('--font-body', font.css);
}

// ===== Topbar Actions =====
export interface TopbarAction {
  label: string;
  icon: any; // Lucide icon component
  onClick: () => void;
  primary?: boolean;
}

export const topbarActions = writable<TopbarAction[]>([]);

export function setTopbarActions(actions: TopbarAction[]) {
  topbarActions.set(actions);
}

export function clearTopbarActions() {
  topbarActions.set([]);
}

// ===== Topbar Custom Content =====
export interface TopbarCustomAction {
  label: string;
  icon?: string;
  onClick: () => void;
  variant?: 'primary' | 'outline' | 'ghost';
}

export interface TopbarCustomContent {
  title?: string;
  subtitle?: string;
  badges?: Array<{ label: string; color: string }>;
  customActions?: TopbarCustomAction[];
}

export const topbarCustomContent = writable<TopbarCustomContent | null>(null);

export function setTopbarCustomContent(content: TopbarCustomContent | null) {
  topbarCustomContent.set(content);
}

export function clearTopbarCustomContent() {
  topbarCustomContent.set(null);
}

// ===== Toast Notifications =====
export const toasts = writable<Toast[]>([]);

let toastCounter = 0;

export function addToast(message: string, type: Toast['type'] = 'info', duration = 3000, action?: { label: string; href: string }) {
  const id = `toast-${++toastCounter}`;
  const toast: Toast = { id, message, type, duration, action };
  toasts.update(arr => [...arr, toast]);
  if (duration > 0) {
    setTimeout(() => removeToast(id), action ? duration * 2 : duration);
  }
  return id;
}

export function removeToast(id: string) {
  toasts.update(arr => arr.filter(t => t.id !== id));
}

// ===== Drive Connect Modal =====
export const showDriveConnectModal = writable(false);

// ===== Team Access Control =====
export const isOwner = writable<boolean>(false);
export const teamPermissions = writable<string[]>([]);
/** Per-company permissions map: { companyId: ['dashboard', 'documents', ...] } */
export const teamPermissionsMap = writable<Record<string, string[]>>({});
export const showUpgradeDialog = writable(false);

/** Active permissions for the currently selected company (or union if __all__) */
export const activeTeamPermissions = derived(
  [teamPermissions, teamPermissionsMap, currentCompanyId],
  ([$union, $map, $compId]) => {
    if (!$compId || $compId === '__all__') return $union; // union of all
    const perCompany = $map[$compId];
    return perCompany !== undefined ? perCompany : $union; // fallback to union if not in map (e.g. owner's own company)
  }
);

/** Path-to-permission mapping */
const PATH_PERM_MAP: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/documents': 'documents',
  '/documents/history': 'history',
  '/customers': 'customers',
  '/products': 'products',
  '/salespersons': 'salespersons',
  '/payments': 'payments',
  '/stock': 'products',
  '/settings': 'settings',
  '/companies': 'companies',
};

/** Paths that require admin role (not just owner) */
const ADMIN_ONLY_PATHS = ['/admin', '/admin/users', '/admin/notifications', '/admin/coupons'];

/** Check if the current user can access a given page path */
export function canAccessPage(path: string, ownerVal: boolean, perms: string[]): boolean {
  // Admin-only pages
  if (ADMIN_ONLY_PATHS.some(p => path === p || path.startsWith(p + '/'))) {
    return false; // only isAdmin check is done separately in the guard
  }
  if (ownerVal) return true; // owners can access everything
  const perm = PATH_PERM_MAP[path];
  if (!perm) return true; // unknown paths (e.g. /account) are allowed by default
  return perms.includes(perm);
}

/** Default navigation priority for redirecting unauthorized team members */
const REDIRECT_PATH_PRIORITY = [
  '/documents',
  '/products',
  '/customers',
  '/documents/history',
  '/payments',
  '/stock',
  '/salespersons',
  '/settings',
  '/companies',
  '/dashboard',
];

/** Get the first page path that a team member is allowed to access */
export function getFirstPermittedPath(perms: string[]): string {
  for (const path of REDIRECT_PATH_PRIORITY) {
    const perm = PATH_PERM_MAP[path];
    if (perm && perms.includes(perm)) return path;
  }
  // Fallback: /account is always accessible
  return '/account';
}
