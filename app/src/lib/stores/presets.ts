// Presets store - localStorage-based preset management for document form fields

export interface Preset {
  name: string;
  note?: string;
  data: Record<string, unknown>;
}

const MAX_PRESETS = 5;

function getStorageKey(category: string): string {
  return `presets.${category}`;
}

export function getPresets(category: string): Preset[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(getStorageKey(category)) || '[]');
  } catch {
    return [];
  }
}

export function savePresets(category: string, presets: Preset[]): void {
  if (typeof window === 'undefined') return;
  localStorage.setItem(getStorageKey(category), JSON.stringify(presets));
}

export function addPreset(category: string, preset: Preset): boolean {
  const presets = getPresets(category);
  if (presets.length >= MAX_PRESETS) return false;
  presets.push(preset);
  savePresets(category, presets);
  return true;
}

export function deletePreset(category: string, index: number): void {
  const presets = getPresets(category);
  presets.splice(index, 1);
  savePresets(category, presets);
}

export function getPreset(category: string, index: number): Preset | null {
  const presets = getPresets(category);
  return presets[index] || null;
}
