import type { CheckName, PresetName, Thresholds } from './types';

export const CHECK_NAMES: readonly CheckName[] = ['sharpness', 'exposure', 'contrast', 'glare', 'shadow', 'skew'];

export const PRESETS: Readonly<Record<PresetName, Readonly<Thresholds>>> = {
  document: {
    minSharpness: 0.4,
    minExposure: 0.5,
    minContrast: 0.3,
    maxGlare: 0.15,
    maxShadow: 0.3,
    maxSkewAngle: 3,
  },
  'kyc-id': {
    minSharpness: 0.5,
    minExposure: 0.55,
    minContrast: 0.35,
    maxGlare: 0.1,
    maxShadow: 0.25,
    maxSkewAngle: 5,
  },
  receipt: {
    minSharpness: 0.35,
    minExposure: 0.45,
    minContrast: 0.2,
    maxGlare: 0.2,
    maxShadow: 0.35,
    maxSkewAngle: 8,
  },
  'a4-scan': {
    minSharpness: 0.5,
    minExposure: 0.55,
    minContrast: 0.35,
    maxGlare: 0.1,
    maxShadow: 0.2,
    maxSkewAngle: 2,
  },
};

/**
 * Merges a preset with user overrides and validates every limit.
 */
export function resolveThresholds(preset: PresetName, overrides: Partial<Thresholds> = {}): Thresholds {
  const base = PRESETS[preset];
  if (!base) {
    throw new TypeError(`Unknown preset "${String(preset)}". Expected one of: ${Object.keys(PRESETS).join(', ')}.`);
  }
  const merged: Thresholds = { ...base };
  for (const [key, value] of Object.entries(overrides) as [keyof Thresholds, number | undefined][]) {
    if (value === undefined) continue;
    if (!(key in base)) {
      throw new TypeError(`Unknown threshold "${key}".`);
    }
    const max = key === 'maxSkewAngle' ? 45 : 1;
    if (typeof value !== 'number' || !Number.isFinite(value) || value < 0 || value > max) {
      throw new RangeError(`Threshold "${key}" must be a number between 0 and ${max}.`);
    }
    merged[key] = value;
  }
  return merged;
}
