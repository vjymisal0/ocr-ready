/**
 * Image input accepted by every check: a file path, a Buffer, or raw image bytes.
 */
export type ImageInput = string | Buffer | Uint8Array;

/**
 * Names of the individual quality checks run by `checkOcrReady`.
 */
export type CheckName = 'sharpness' | 'exposure' | 'contrast' | 'glare' | 'shadow' | 'skew';

/**
 * Built-in threshold presets.
 * - `'document'`: general phone photo of a printed page (default).
 * - `'kyc-id'`: ID cards and passports, where glare and blur break verification.
 * - `'receipt'`: thermal receipts, which are low contrast and often curled or tilted.
 * - `'a4-scan'`: flatbed or sheet-fed scans, which should be flat, even and straight.
 */
export type PresetName = 'document' | 'kyc-id' | 'receipt' | 'a4-scan';

/**
 * Pass/fail limits for each check. Every check maps to one limit.
 */
export interface Thresholds {
  /** Minimum sharpness score (0-1) from `blur-score`. */
  minSharpness: number;
  /** Minimum exposure score (0-1) from `exposure-score`, tuned for paper. */
  minExposure: number;
  /** Minimum contrast score (0-1) from `contrast-score`. */
  minContrast: number;
  /** Maximum glare score (0-1) from `glare-score`. */
  maxGlare: number;
  /** Maximum shadow score (0-1) from `shadow-score`, tuned for paper. */
  maxShadow: number;
  /** Maximum absolute tilt in degrees from `skew-score`. */
  maxSkewAngle: number;
}

/**
 * Options for `checkOcrReady`.
 */
export interface OcrReadyOptions {
  /**
   * Threshold preset to start from.
   * @default 'document'
   */
  preset?: PresetName;
  /**
   * Overrides applied on top of the preset.
   */
  thresholds?: Partial<Thresholds>;
  /**
   * Checks to leave out, e.g. `['skew']` when your pipeline deskews anyway.
   */
  skip?: CheckName[];
}

/**
 * Outcome of one quality check.
 */
export interface CheckResult {
  /** Which check this is. */
  check: CheckName;
  /** Whether the image is within the limit for this check. */
  pass: boolean;
  /**
   * Measured value: a 0-1 score for most checks, or the tilt angle in degrees for `skew`.
   */
  value: number;
  /** The threshold the value was compared against. */
  limit: number;
  /**
   * Quality on a common 0-1 scale where 1 is best, so checks can be compared.
   */
  quality: number;
  /** Short explanation of the measurement. */
  message: string;
  /** What to change when retaking the photo. Present only when the check fails. */
  hint?: string;
}

/**
 * Combined result of all checks.
 */
export interface OcrReadyResult {
  /** True when every check that ran passed. */
  ready: boolean;
  /**
   * Overall quality from 0.0 to 1.0: the lowest `quality` of all checks that ran.
   */
  score: number;
  /** The preset the thresholds came from. */
  preset: PresetName;
  /** Effective thresholds after overrides. */
  thresholds: Thresholds;
  /** Every check that ran, in a fixed order. */
  checks: CheckResult[];
  /** Only the failed checks, worst quality first. */
  failures: CheckResult[];
}
