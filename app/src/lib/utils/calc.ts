import { roundMoney } from './helpers';
import type { DocLine } from '$lib/types';

export type CustomFeeVatMode = 'NO_VAT' | 'EXCLUSIVE' | 'INCLUSIVE';

export interface CalcInput {
  lines: Array<{
    qty: number;
    unitPrice: number;
    discountType?: string;
    discountValue?: number;
    taxRate?: string;
  }>;
  discountEnabled: boolean;
  discountType: 'AMOUNT' | 'PERCENT';
  discountValue: number;
  vatEnabled: boolean;
  vatRate: number;
  vatInclusive?: boolean;
  whtEnabled: boolean;
  whtRate: number;
  customFeeEnabled?: boolean;
  customFeeAmount?: number;
  customFeeVatMode?: CustomFeeVatMode;
}

export interface CalcResult {
  subtotal: number;
  itemDiscountTotal: number;
  afterItemDiscount: number;
  discount: number;
  totalBeforeTax: number;
  preTaxBase: number;
  vatAmount: number;
  whtAmount: number;
  customFeeAmount: number;
  customFeeVatAmount: number;
  exemptTotal: number;
  grandTotal: number;
  lineTotals: number[];
}

export function calculateDocument(input: CalcInput): CalcResult {
  let subtotal = 0;
  let itemDiscountTotal = 0;
  let exemptLineTotal = 0;
  const lineTotals: number[] = [];

  for (const item of input.lines) {
    const qty = item.qty || 1;
    const unitPrice = item.unitPrice || 0;
    const lineGross = roundMoney(qty * unitPrice);
    subtotal += lineGross;

    const itemDiscType = (item.discountType || '').toUpperCase();
    const itemDiscVal = item.discountValue || 0;
    let itemDisc = 0;
    if (itemDiscVal > 0) {
      itemDisc = itemDiscType === 'PERCENT'
        ? roundMoney(lineGross * itemDiscVal / 100)
        : itemDiscVal;
    }
    itemDiscountTotal += itemDisc;
    const lineNet = roundMoney(lineGross - itemDisc);
    lineTotals.push(lineNet);

    // Track tax-exempt line totals
    if (item.taxRate === 'exempt') {
      exemptLineTotal += lineNet;
    }
  }

  subtotal = roundMoney(subtotal);
  const afterItemDiscount = roundMoney(subtotal - itemDiscountTotal);

  let discount = 0;
  if (input.discountEnabled) {
    discount = input.discountType === 'PERCENT'
      ? roundMoney(afterItemDiscount * input.discountValue / 100)
      : input.discountValue;
  }
  let totalBeforeTax = roundMoney(afterItemDiscount - discount);

  const vatInclusive = input.vatInclusive || false;
  const customFeeEnabled = input.customFeeEnabled || false;
  const customFeeAmount = customFeeEnabled ? (input.customFeeAmount || 0) : 0;
  const customFeeVatMode: CustomFeeVatMode = input.customFeeVatMode || 'NO_VAT';

  // EXCLUSIVE mode: add fee to base before VAT/WHT calculation
  if (customFeeEnabled && customFeeAmount > 0 && customFeeVatMode === 'EXCLUSIVE') {
    totalBeforeTax = roundMoney(totalBeforeTax + customFeeAmount);
  }

  // INCLUSIVE mode: extract VAT from fee and add base to totalBeforeTax
  let customFeeVatAmount = 0;
  if (customFeeEnabled && customFeeAmount > 0 && customFeeVatMode === 'INCLUSIVE' && input.vatEnabled) {
    customFeeVatAmount = roundMoney(customFeeAmount * input.vatRate / (100 + input.vatRate));
    const feeBase = roundMoney(customFeeAmount - customFeeVatAmount);
    totalBeforeTax = roundMoney(totalBeforeTax + feeBase);
  }

  // Calculate exempt total: proportion of exemptLineTotal relative to afterItemDiscount
  // If there's a document-level discount, distribute it proportionally
  let exemptTotal = exemptLineTotal;
  if (input.discountEnabled && discount > 0 && afterItemDiscount > 0) {
    // Proportionally reduce exempt amount by the document discount ratio
    const discountRatio = discount / afterItemDiscount;
    exemptTotal = roundMoney(exemptLineTotal * (1 - discountRatio));
  }

  // VAT base excludes exempt items
  const vatBase = roundMoney(totalBeforeTax - exemptTotal);

  let vatAmount = 0;
  if (input.vatEnabled) {
    if (vatInclusive) {
      vatAmount = roundMoney(vatBase - (vatBase / (1 + input.vatRate / 100)));
    } else {
      vatAmount = roundMoney(vatBase * input.vatRate / 100);
    }
  }
  // Add extracted fee VAT for INCLUSIVE mode
  if (customFeeVatAmount > 0) {
    vatAmount = roundMoney(vatAmount + customFeeVatAmount);
  }

  // preTaxBase: the actual taxable amount before any VAT (for display purposes)
  let preTaxBase = vatBase;
  if (input.vatEnabled && vatInclusive) {
    preTaxBase = roundMoney(vatBase / (1 + input.vatRate / 100));
  }

  let whtAmount = 0;
  if (input.whtEnabled) {
    // WHT is calculated on total (including exempt), not just vatBase
    let whtBase = totalBeforeTax;
    if (input.vatEnabled && vatInclusive) {
      whtBase = totalBeforeTax / (1 + input.vatRate / 100);
    }
    whtAmount = roundMoney(whtBase * input.whtRate / 100);
  }

  // Grand total calculation
  let grandTotal: number;
  if (customFeeVatMode === 'NO_VAT') {
    // NO_VAT: fee added at the very end
    grandTotal = vatInclusive
      ? roundMoney(totalBeforeTax - whtAmount + customFeeAmount)
      : roundMoney(totalBeforeTax + vatAmount - whtAmount + customFeeAmount);
  } else {
    // EXCLUSIVE & INCLUSIVE: fee is already folded into totalBeforeTax
    grandTotal = vatInclusive
      ? roundMoney(totalBeforeTax - whtAmount)
      : roundMoney(totalBeforeTax + vatAmount - whtAmount);
  }

  return {
    subtotal,
    itemDiscountTotal,
    afterItemDiscount,
    discount,
    totalBeforeTax,
    preTaxBase,
    vatAmount,
    whtAmount,
    customFeeAmount,
    customFeeVatAmount,
    exemptTotal,
    grandTotal,
    lineTotals
  };
}
