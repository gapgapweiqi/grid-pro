import { PAYMENT_STATUS_LABELS, DOC_STATUS_LABELS, DOC_TYPES } from '$lib/config/constants';
import type { DocType } from '$lib/types';

export function formatMoney(value: number, currency = 'THB'): string {
  return new Intl.NumberFormat('th-TH', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value || 0);
}

export function formatCompactMoney(value: number): string {
  if (value >= 1e6) return (value / 1e6).toFixed(1) + 'M';
  if (value >= 1e3) return (value / 1e3).toFixed(1) + 'K';
  return formatMoney(value);
}

export function formatDate(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const day = d.getDate();
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    const month = months[d.getMonth()];
    const year = d.getFullYear() + 543;
    return `${day} ${month} ${year}`;
  } catch {
    return dateStr;
  }
}

export function formatDateShort(dateStr: string): string {
  if (!dateStr) return '';
  try {
    const d = new Date(dateStr);
    const dd = String(d.getDate()).padStart(2, '0');
    const mm = String(d.getMonth() + 1).padStart(2, '0');
    const yy = String(d.getFullYear() + 543).slice(-2);
    return `${dd}/${mm}/${yy}`;
  } catch {
    return dateStr;
  }
}

export function formatTaxId(taxId: string): string {
  if (!taxId) return '';
  const digits = taxId.replace(/\D/g, '');
  if (digits.length === 13) {
    return digits.replace(/(\d{1})(\d{4})(\d{5})(\d{2})(\d{1})/, '$1 $2 $3 $4 $5');
  }
  return taxId;
}

export function formatPhone(phone: string): string {
  if (!phone) return '';
  const digits = phone.replace(/\D/g, '');
  if (digits.length === 10) {
    if (digits.startsWith('02')) {
      return digits.replace(/(\d{2})(\d{3})(\d{4})/, '$1 $2 $3');
    }
    return digits.replace(/(\d{3})(\d{3})(\d{4})/, '$1 $2 $3');
  }
  return phone;
}

export function getDocTypeLabel(docType: DocType): string {
  const dt = DOC_TYPES.find(d => d.id === docType);
  return dt ? dt.labelTh : docType;
}

export function getDocTypeEn(docType: DocType): string {
  const dt = DOC_TYPES.find(d => d.id === docType);
  return dt ? dt.label : docType;
}

export function getPaymentStatusLabel(status: string): string {
  return PAYMENT_STATUS_LABELS[status] || status;
}

export function getDocStatusLabel(status: string): string {
  return DOC_STATUS_LABELS[status] || status;
}

const ONES = ['', 'หนึ่ง', 'สอง', 'สาม', 'สี่', 'ห้า', 'หก', 'เจ็ด', 'แปด', 'เก้า'];
const POSITIONS = ['', 'สิบ', 'ร้อย', 'พัน', 'หมื่น', 'แสน', 'ล้าน'];

function bahtTextPart(n: number): string {
  if (n === 0) return '';
  const str = String(Math.floor(n));
  let result = '';
  const len = str.length;
  for (let i = 0; i < len; i++) {
    const digit = parseInt(str[i]);
    const pos = len - i - 1;
    if (digit === 0) continue;
    if (pos === 0 && digit === 1 && len > 1) {
      result += 'เอ็ด';
    } else if (pos === 1 && digit === 1) {
      result += 'สิบ';
    } else if (pos === 1 && digit === 2) {
      result += 'ยี่สิบ';
    } else {
      result += ONES[digit] + POSITIONS[pos];
    }
  }
  return result;
}

// ===== English Amount in Words =====

const EN_ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine',
  'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const EN_TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function englishNumberPart(n: number): string {
  if (n === 0) return '';
  if (n < 20) return EN_ONES[n];
  if (n < 100) return EN_TENS[Math.floor(n / 10)] + (n % 10 ? '-' + EN_ONES[n % 10] : '');
  if (n < 1000) return EN_ONES[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + englishNumberPart(n % 100) : '');
  if (n < 1000000) return englishNumberPart(Math.floor(n / 1000)) + ' Thousand' + (n % 1000 ? ' ' + englishNumberPart(n % 1000) : '');
  if (n < 1000000000) return englishNumberPart(Math.floor(n / 1000000)) + ' Million' + (n % 1000000 ? ' ' + englishNumberPart(n % 1000000) : '');
  return englishNumberPart(Math.floor(n / 1000000000)) + ' Billion' + (n % 1000000000 ? ' ' + englishNumberPart(n % 1000000000) : '');
}

export function amountToEnglishWords(amount: number): string {
  if (amount === 0) return 'Zero Baht Only';
  const abs = Math.abs(amount);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);

  let result = '';
  if (amount < 0) result += 'Minus ';
  if (intPart > 0) result += englishNumberPart(intPart) + ' Baht';
  if (decPart > 0) {
    if (intPart > 0) result += ' and ';
    result += englishNumberPart(decPart) + ' Satang';
  } else {
    result += ' Only';
  }
  return result;
}

export function bahtText(amount: number): string {
  if (amount === 0) return 'ศูนย์บาทถ้วน';
  const abs = Math.abs(amount);
  const intPart = Math.floor(abs);
  const decPart = Math.round((abs - intPart) * 100);

  let result = '';
  if (amount < 0) result += 'ลบ';

  if (intPart > 0) {
    if (intPart >= 1000000) {
      result += bahtTextPart(Math.floor(intPart / 1000000)) + 'ล้าน';
      const remainder = intPart % 1000000;
      if (remainder > 0) result += bahtTextPart(remainder);
    } else {
      result += bahtTextPart(intPart);
    }
    result += 'บาท';
  }

  if (decPart > 0) {
    result += bahtTextPart(decPart) + 'สตางค์';
  } else {
    result += 'ถ้วน';
  }

  return result;
}
