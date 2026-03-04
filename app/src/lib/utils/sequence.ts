import { padNumber } from './helpers';

export interface DocNoSettings {
  pattern: string;
  digits: number;
  separator: string;
  prefixes: Record<string, string>;
}

export const DEFAULT_DOC_NO_SETTINGS: DocNoSettings = {
  pattern: 'A',
  digits: 4,
  separator: '-',
  prefixes: {
    QUO: 'QUO',
    INV: 'INV',
    BILL: 'BN',
    TAX: 'TAX',
    RCPT: 'RCP',
    DO: 'DO',
    PO: 'PO',
    CN: 'CN',
    PV: 'PV',
    PR: 'PR'
  }
};

function buildDatePart(pattern: string): string {
  const now = new Date();
  const bYear = now.getFullYear() + 543;
  const cYear = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  switch (pattern) {
    case 'A': return String(bYear).slice(-2) + mm;
    case 'B': return String(bYear).slice(-2);
    case 'C': return String(bYear);
    case 'D': return String(cYear).slice(-2) + mm;
    case 'E': return String(cYear);
    default: return String(bYear).slice(-2) + mm;
  }
}

export function buildPeriodKey(pattern: string): string {
  return buildDatePart(pattern);
}

export function generateDocNo(
  docType: string,
  seq: number,
  settings: DocNoSettings = DEFAULT_DOC_NO_SETTINGS
): string {
  const prefix = settings.prefixes[docType] || docType;
  const datePart = buildDatePart(settings.pattern);
  return prefix + datePart + settings.separator + padNumber(seq, settings.digits);
}

export function findNextAvailableDocNo(
  docType: string,
  startSeq: number,
  existingDocNos: Set<string>,
  settings: DocNoSettings = DEFAULT_DOC_NO_SETTINGS
): { docNo: string; seq: number } {
  let seq = startSeq;
  let candidate = generateDocNo(docType, seq, settings);
  while (existingDocNos.has(candidate.toUpperCase())) {
    seq++;
    candidate = generateDocNo(docType, seq, settings);
  }
  return { docNo: candidate, seq };
}
