import type { DocType } from '$lib/types';

const STORAGE_KEY = 'docPrefs';

export interface LineColumnVisibility {
  rowNum?: boolean;
  code?: boolean;
  name?: boolean;
  description?: boolean;
  qty?: boolean;
  unit?: boolean;
  unitPrice?: boolean;
  discount?: boolean;
  tax?: boolean;
}

export interface DocPrefs {
  vatEnabled?: boolean;
  vatRate?: number;
  vatInclusive?: boolean;
  whtEnabled?: boolean;
  whtRate?: number;
  signatureEnabled?: boolean;
  stampEnabled?: boolean;
  showBankInfo?: boolean;
  paymentTermsEnabled?: boolean;
  itemMode?: 'product' | 'service';
  lineColumnVisibility?: LineColumnVisibility;
}

function getAllPrefs(): Record<string, DocPrefs> {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}');
  } catch {
    return {};
  }
}

export function loadDocPrefs(docType: DocType): DocPrefs {
  const all = getAllPrefs();
  return all[docType] || {};
}

export function saveDocPrefs(docType: DocType, prefs: DocPrefs): void {
  if (typeof window === 'undefined') return;
  const all = getAllPrefs();
  all[docType] = prefs;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
  } catch { /* ignore quota errors */ }
}
