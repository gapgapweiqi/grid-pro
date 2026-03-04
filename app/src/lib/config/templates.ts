import type { DocType } from '$lib/types';

export interface DocTemplate {
  id: string;
  name: string;
  description: string;
  applicableDocTypes: DocType[] | 'ALL';
  layout: 'standard' | 'modern' | 'minimal' | 'classic';
  config: {
    showLogo: boolean;
    logoPosition: 'left' | 'center';
    showBorder: boolean;
    headerStyle: 'split' | 'full-width' | 'centered';
    colorMode: 'accent' | 'monochrome' | 'minimal';
    tableStyle: 'striped' | 'bordered' | 'clean';
  };
}

export const BUILT_IN_TEMPLATES: DocTemplate[] = [
  {
    id: 'standard',
    name: 'Standard',
    description: 'แบบมาตรฐาน — โลโก้ซ้าย ชื่อเอกสารขวา ตารางมีเส้น',
    applicableDocTypes: 'ALL',
    layout: 'standard',
    config: {
      showLogo: true,
      logoPosition: 'left',
      showBorder: false,
      headerStyle: 'split',
      colorMode: 'accent',
      tableStyle: 'bordered',
    },
  },
  {
    id: 'modern',
    name: 'Modern',
    description: 'แบบทันสมัย — แถบสีด้านบน ฟอนต์ใหญ่ ดีไซน์กว้าง',
    applicableDocTypes: 'ALL',
    layout: 'modern',
    config: {
      showLogo: true,
      logoPosition: 'left',
      showBorder: false,
      headerStyle: 'full-width',
      colorMode: 'accent',
      tableStyle: 'striped',
    },
  },
  {
    id: 'minimal',
    name: 'Minimal',
    description: 'แบบเรียบง่าย — ไม่มี background สี เส้นบางๆ',
    applicableDocTypes: 'ALL',
    layout: 'minimal',
    config: {
      showLogo: true,
      logoPosition: 'left',
      showBorder: false,
      headerStyle: 'split',
      colorMode: 'minimal',
      tableStyle: 'clean',
    },
  },
  {
    id: 'classic',
    name: 'Classic',
    description: 'แบบคลาสสิก — กรอบเส้นทั้งหน้า หัวเอกสารอยู่กลาง',
    applicableDocTypes: 'ALL',
    layout: 'classic',
    config: {
      showLogo: true,
      logoPosition: 'center',
      showBorder: true,
      headerStyle: 'centered',
      colorMode: 'accent',
      tableStyle: 'bordered',
    },
  },
];

// Get template for a specific doc type (reads from localStorage)
export function getTemplateForDocType(docType: DocType): DocTemplate {
  if (typeof window === 'undefined') return BUILT_IN_TEMPLATES[0];
  const perType = localStorage.getItem(`docTemplate.${docType}`);
  if (perType) {
    const found = BUILT_IN_TEMPLATES.find(t => t.id === perType);
    if (found) return found;
  }
  const defaultId = localStorage.getItem('docTemplate.default') || 'standard';
  return BUILT_IN_TEMPLATES.find(t => t.id === defaultId) || BUILT_IN_TEMPLATES[0];
}

// Save template assignment
export function setTemplateForDocType(docType: DocType | 'default', templateId: string): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(`docTemplate.${docType}`, templateId);
}

// Get the currently assigned template ID for a doc type
export function getTemplateIdForDocType(docType: DocType): string {
  if (typeof window === 'undefined') return 'standard';
  return localStorage.getItem(`docTemplate.${docType}`) || localStorage.getItem('docTemplate.default') || 'standard';
}
