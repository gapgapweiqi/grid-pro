// ===== Configuration (No Google Sheets) =====

const DOC_TYPES = [
  { id: "QUO", label: "Quotation", category: "sales" },
  { id: "INV", label: "Invoice", category: "sales" },
  { id: "BILL", label: "Billing Note", category: "sales" },
  { id: "TAX", label: "Tax Invoice", category: "sales" },
  { id: "RCPT", label: "Receipt", category: "sales" },
  { id: "DO", label: "Delivery Order", category: "sales" },
  { id: "PO", label: "Purchase Order", category: "purchase" },
  { id: "CN", label: "Credit Note", category: "finance" },
  { id: "PV", label: "Payment Voucher", category: "finance" },
  { id: "PR", label: "Purchase Request", category: "purchase" }
];

const FONT_OPTIONS = [
  { id: "sarabun", label: "Sarabun", css: '"Sarabun", "Noto Sans Thai", "IBM Plex Sans Thai", Arial, sans-serif' },
  { id: "noto", label: "Noto Sans Thai", css: '"Noto Sans Thai", "Sarabun", Arial, sans-serif' },
  { id: "ibm", label: "IBM Plex Sans Thai", css: '"IBM Plex Sans Thai", "Sarabun", Arial, sans-serif' },
  { id: "system", label: "System UI", css: 'system-ui, -apple-system, "Segoe UI", Arial, sans-serif' }
];

const THEME_OPTIONS = [
  { id: "blue", label: "Deep Blue", value: "#1f3a5f" },
  { id: "green", label: "Deep Green", value: "#1f6f54" },
  { id: "purple", label: "Deep Purple", value: "#4b2b7f" }
];

const DEFAULT_SETTINGS = {
  currency: "THB",
  vatRate: 7,
  whtRate: 3,
  theme: "blue",
  font: "sarabun"
};

const CODE_PREFIX = {
  COMPANY: "CO",
  CUSTOMER: "C",
  PRODUCT: "P"
};

const CODE_PAD_LENGTH = 4;

function getUiConfig() {
  return {
    docTypes: DOC_TYPES,
    fonts: FONT_OPTIONS,
    themes: THEME_OPTIONS,
    defaults: DEFAULT_SETTINGS
  };
}
