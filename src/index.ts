import { readFile } from 'node:fs/promises';
import { getBlurScore } from 'blur-score';
import { getExposureInfo } from 'exposure-score';
import { analyzeContrast } from 'contrast-score';
import { analyzeGlare } from 'glare-score';
import { analyzeShadow } from 'shadow-score';
import { analyzeSkew } from 'skew-score';
import { CHECK_NAMES, PRESETS, resolveThresholds } from './presets';
import type { CheckName, CheckResult, ImageInput, OcrReadyOptions, OcrReadyResult, Thresholds } from './types';

export type { CheckName, CheckResult, ImageInput, OcrReadyOptions, OcrReadyResult, PresetName, Thresholds } from './types';
export { PRESETS, resolveThresholds };

// The scorers' defaults target general photos. A page of dark text on white
// paper is bright by design and full of small dark blocks, so exposure is
// penalised less for a bright mean and shadow smoothing is widened to wash
// out text lines before the illumination field is measured.
const EXPOSURE_TUNING = { deviationWeight: 0.6 };
const SHADOW_TUNING = { smoothingRadius: 16 };

const round = (n: number, digits = 3) => Number(n.toFixed(digits));
const clamp01 = (n: number) => Math.min(1, Math.max(0, n));

async function toBuffer(input: ImageInput): Promise<Buffer> {
  if (typeof input === 'string') {
    if (input.length === 0) throw new TypeError('Image path must not be empty.');
    return readFile(input);
  }
  if (Buffer.isBuffer(input)) return input;
  if (input instanceof Uint8Array) return Buffer.from(input.buffer, input.byteOffset, input.byteLength);
  throw new TypeError('Input must be a file path string, Buffer, or Uint8Array.');
}

type Runner = (image: Buffer, t: Thresholds) => Promise<CheckResult>;

const RUNNERS: Record<CheckName, Runner> = {
  async sharpness(image, t) {
    const value = await getBlurScore(image);
    const pass = value >= t.minSharpness;
    return {
      check: 'sharpness',
      pass,
      value: round(value),
      limit: t.minSharpness,
      quality: round(value),
      message: `sharpness ${round(value, 2)} (min ${t.minSharpness})`,
      hint: pass ? undefined : 'Image is blurry. Hold the camera steady, tap to focus, and avoid zooming.',
    };
  },

  async exposure(image, t) {
    const info = await getExposureInfo(image, EXPOSURE_TUNING);
    const pass = info.score >= t.minExposure;
    const tooDark = info.mean < 128;
    return {
      check: 'exposure',
      pass,
      value: round(info.score),
      limit: t.minExposure,
      quality: round(info.score),
      message: `exposure ${round(info.score, 2)} (min ${t.minExposure}), mean brightness ${Math.round(info.mean)}`,
      hint: pass
        ? undefined
        : tooDark
          ? 'Image is too dark. Move to brighter light or turn on room lights.'
          : 'Image is washed out. Reduce direct light or lower the exposure.',
    };
  },

  async contrast(image, t) {
    const res = await analyzeContrast(image);
    const pass = res.score >= t.minContrast;
    return {
      check: 'contrast',
      pass,
      value: round(res.score),
      limit: t.minContrast,
      quality: round(res.score),
      message: `contrast ${round(res.score, 2)} (min ${t.minContrast})`,
      hint: pass ? undefined : 'Text does not stand out from the background. Use even, brighter light and a plain dark surface behind the page.',
    };
  },

  async glare(image, t) {
    const res = await analyzeGlare(image);
    const pass = res.score <= t.maxGlare;
    return {
      check: 'glare',
      pass,
      value: round(res.score),
      limit: t.maxGlare,
      quality: round(1 - res.score),
      message: `glare ${round(res.score, 2)} (max ${t.maxGlare}), ${res.hotspotCount} hotspot(s) covering ${round(res.glarePercentage, 1)}%`,
      hint: pass ? undefined : 'Light is reflecting off the surface. Turn off the flash and tilt the document away from the light.',
    };
  },

  async shadow(image, t) {
    const res = await analyzeShadow(image, SHADOW_TUNING);
    const pass = res.score <= t.maxShadow;
    return {
      check: 'shadow',
      pass,
      value: round(res.score),
      limit: t.maxShadow,
      quality: round(1 - res.score),
      // On an evenly lit page Otsu still splits text from paper, so the shaded
      // area is only meaningful once the score says a shadow is present.
      message: pass
        ? `shadow ${round(res.score, 2)} (max ${t.maxShadow})`
        : `shadow ${round(res.score, 2)} (max ${t.maxShadow}), ${round(res.shadowAreaPercentage, 1)}% of the area shaded`,
      hint: pass ? undefined : 'A shadow covers part of the page. Move so your hand or phone does not block the light.',
    };
  },

  async skew(image, t) {
    const res = await analyzeSkew(image);
    const angle = Math.abs(res.angle);
    // A low-confidence angle (blank page, photo without text lines) is not
    // evidence of tilt, so it never fails the check.
    const reliable = res.confidence >= 0.2;
    const pass = !reliable || angle <= t.maxSkewAngle;
    return {
      check: 'skew',
      pass,
      value: round(res.angle, 2),
      limit: t.maxSkewAngle,
      quality: reliable ? round(clamp01(1 - angle / 45)) : 1,
      message: reliable
        ? `tilt ${round(res.angle, 1)}° (max ${t.maxSkewAngle}°)`
        : `tilt unknown (confidence ${round(res.confidence, 2)}), not checked`,
      hint: pass ? undefined : `Page is tilted ${round(angle, 1)}°. Line the page up with the frame, or rotate by ${round(res.correctiveRotation, 1)}° before OCR.`,
    };
  },
};

function validateOptions(options: OcrReadyOptions): void {
  if (options === null || typeof options !== 'object') {
    throw new TypeError('Options must be an object.');
  }
  for (const name of options.skip ?? []) {
    if (!CHECK_NAMES.includes(name)) {
      throw new TypeError(`Unknown check "${String(name)}" in skip. Expected one of: ${CHECK_NAMES.join(', ')}.`);
    }
  }
}

/**
 * Runs every quality check on a document photo and reports whether it is
 * good enough to send to OCR, with the reason and a retake hint for each failure.
 *
 * @param input - Image file path, Buffer, or Uint8Array.
 * @param options - Preset, threshold overrides, and checks to skip.
 * @returns Promise resolving to a detailed OcrReadyResult.
 */
export async function checkOcrReady(input: ImageInput, options: OcrReadyOptions = {}): Promise<OcrReadyResult> {
  validateOptions(options);
  const preset = options.preset ?? 'document';
  const thresholds = resolveThresholds(preset, options.thresholds);
  const skip = new Set(options.skip ?? []);
  const names = CHECK_NAMES.filter((name) => !skip.has(name));
  if (names.length === 0) {
    throw new TypeError('At least one check must run.');
  }

  const image = await toBuffer(input);
  const checks = await Promise.all(names.map((name) => RUNNERS[name](image, thresholds)));
  for (const c of checks) if (c.hint === undefined) delete c.hint;

  const failures = checks.filter((c) => !c.pass).sort((a, b) => a.quality - b.quality);
  return {
    ready: failures.length === 0,
    score: Math.min(...checks.map((c) => c.quality)),
    preset,
    thresholds,
    checks,
    failures,
  };
}

/**
 * Returns true when the image passes every check.
 *
 * @param input - Image file path, Buffer, or Uint8Array.
 * @param options - Preset, threshold overrides, and checks to skip.
 * @returns Promise resolving to a boolean.
 */
export async function isOcrReady(input: ImageInput, options?: OcrReadyOptions): Promise<boolean> {
  return (await checkOcrReady(input, options)).ready;
}
