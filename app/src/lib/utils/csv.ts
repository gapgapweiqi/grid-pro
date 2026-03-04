/**
 * CSV import/export utilities for master data.
 * Handles Thai-friendly CSV with BOM for Excel compatibility.
 */
import { csvEscape } from './helpers';

// ===== Export =====

export interface CsvColumn<T> {
  header: string;
  accessor: (item: T) => string | number;
}

export function exportCsv<T>(items: T[], columns: CsvColumn<T>[], filename: string) {
  const BOM = '\uFEFF';
  const headerRow = columns.map(c => csvEscape(c.header)).join(',');
  const dataRows = items.map(item =>
    columns.map(c => {
      const val = c.accessor(item);
      return csvEscape(String(val ?? ''));
    }).join(',')
  );
  const csvContent = BOM + [headerRow, ...dataRows].join('\r\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ===== Import =====

export interface CsvParseResult {
  headers: string[];
  rows: Record<string, string>[];
  errors: string[];
}

export function parseCsv(text: string): CsvParseResult {
  const errors: string[] = [];
  // Remove BOM if present
  const clean = text.replace(/^\uFEFF/, '');
  const lines = clean.split(/\r?\n/).filter(l => l.trim());

  if (lines.length < 2) {
    return { headers: [], rows: [], errors: ['ไฟล์ CSV ต้องมีอย่างน้อย 2 บรรทัด (header + data)'] };
  }

  const headers = parseCsvLine(lines[0]);
  const rows: Record<string, string>[] = [];

  for (let i = 1; i < lines.length; i++) {
    const values = parseCsvLine(lines[i]);
    if (values.length !== headers.length) {
      errors.push(`บรรทัด ${i + 1}: จำนวนคอลัมน์ไม่ตรง (ได้ ${values.length}, ต้องการ ${headers.length})`);
      continue;
    }
    const row: Record<string, string> = {};
    headers.forEach((h, idx) => { row[h] = values[idx]; });
    rows.push(row);
  }

  return { headers, rows, errors };
}

function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;
  let i = 0;

  while (i < line.length) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i += 2;
        } else {
          inQuotes = false;
          i++;
        }
      } else {
        current += ch;
        i++;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
        i++;
      } else if (ch === ',') {
        result.push(current.trim());
        current = '';
        i++;
      } else {
        current += ch;
        i++;
      }
    }
  }
  result.push(current.trim());
  return result;
}

/** Read a File object as text */
export function readFileAsText(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('ไม่สามารถอ่านไฟล์ได้'));
    reader.readAsText(file, 'UTF-8');
  });
}

// ===== Predefined column configs =====

import type { Product, Customer, Salesperson } from '$lib/types';

export const PRODUCT_CSV_COLUMNS: CsvColumn<Product>[] = [
  { header: 'รหัส', accessor: p => p.code },
  { header: 'ชื่อสินค้า', accessor: p => p.name },
  { header: 'ชื่อสินค้า (EN)', accessor: p => p.name2 },
  { header: 'หน่วย', accessor: p => (p.json.unit as string) || '' },
  { header: 'ราคา', accessor: p => (p.json.price as number) || 0 },
  { header: 'หมวดหมู่', accessor: p => (p.json.category as string) || '' },
  { header: 'สถานะ', accessor: p => p.status }
];

export const CUSTOMER_CSV_COLUMNS: CsvColumn<Customer>[] = [
  { header: 'รหัส', accessor: c => c.code },
  { header: 'ชื่อลูกค้า', accessor: c => c.name },
  { header: 'ชื่อลูกค้า (EN)', accessor: c => c.name2 },
  { header: 'เลขผู้เสียภาษี', accessor: c => c.taxId },
  { header: 'โทรศัพท์', accessor: c => c.phone },
  { header: 'อีเมล', accessor: c => c.email },
  { header: 'ที่อยู่', accessor: c => c.address },
  { header: 'สถานะ', accessor: c => c.status }
];

export const SALESPERSON_CSV_COLUMNS: CsvColumn<Salesperson>[] = [
  { header: 'รหัส', accessor: s => s.code },
  { header: 'ชื่อ', accessor: s => s.name },
  { header: 'โทรศัพท์', accessor: s => s.phone },
  { header: 'อีเมล', accessor: s => s.email },
  { header: 'ตำแหน่ง', accessor: s => (s.json.position as string) || '' },
  { header: 'สถานะ', accessor: s => s.status }
];
