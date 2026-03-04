export function safeString(value: unknown): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

export function toBoolean(value: unknown): boolean {
  if (value === true || value === false) return value;
  if (value === null || value === undefined || value === '') return false;
  if (typeof value === 'number') return value !== 0;
  const text = safeString(value).toLowerCase().trim();
  return text === 'true' || text === '1' || text === 'yes' || text === 'on';
}

export function safeJsonParse<T>(value: unknown, fallback: T): T {
  if (!value) return fallback;
  if (typeof value === 'object') return value as T;
  try {
    return JSON.parse(String(value)) as T;
  } catch {
    return fallback;
  }
}

export function roundMoney(value: number): number {
  return Math.round((value || 0) * 100) / 100;
}

export function padNumber(value: number | string, length: number): string {
  let text = safeString(value);
  while (text.length < length) text = '0' + text;
  return text;
}

export function csvEscape(value: unknown): string {
  let text = safeString(value);
  if (text.includes('"')) text = text.replace(/"/g, '""');
  if (/[",\n]/.test(text)) text = '"' + text + '"';
  return text;
}

export function generateUuid(): string {
  return crypto.randomUUID();
}

export function nowIso(): string {
  return new Date().toISOString();
}

const API_BASE = typeof import.meta !== 'undefined' ? (import.meta.env?.VITE_API_URL || '') : '';

/** Resolve avatar URL — prepend API_BASE if it's a relative path */
export function resolveAvatarUrl(url: string | undefined | null): string {
  if (!url) return '';
  // Already absolute URL
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  // Relative path like /api/images/avatars/... → prepend API_BASE
  return `${API_BASE}${url}`;
}

export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace('#', '');
  const bigint = parseInt(value, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}
