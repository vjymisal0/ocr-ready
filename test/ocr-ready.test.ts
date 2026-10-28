import { describe, it, expect, beforeAll } from 'vitest';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { checkOcrReady, isOcrReady, PRESETS, resolveThresholds } from '../src';
import { fixtures } from './fixtures';

describe('ocr-ready', () => {
  let img: Record<string, Buffer>;

  beforeAll(async () => {
    img = await fixtures();
  });

  it('passes a clean, sharp, evenly lit page', async () => {
    const r = await checkOcrReady(img.clean);
    expect(r.ready).toBe(true);
    expect(r.failures).toEqual([]);
    expect(r.checks.map((c) => c.check)).toEqual(['sharpness', 'exposure', 'contrast', 'glare', 'shadow', 'skew']);
    expect(r.score).toBeGreaterThan(0.5);
    expect(r.checks.every((c) => c.hint === undefined)).toBe(true);
  });

  it.each([
    ['blurry', 'sharpness'],
    ['dark', 'exposure'],
    ['faded', 'contrast'],
    ['glare', 'glare'],
    ['shadow', 'shadow'],
    ['skewed', 'skew'],
  ])('flags the %s page with a %s failure and a hint', async (fixture, check) => {
    const r = await checkOcrReady(img[fixture]);
    expect(r.ready).toBe(false);
    const failure = r.failures.find((f) => f.check === check);
    expect(failure).toBeDefined();
    expect(failure!.hint).toMatch(/\w/);
  });

  it('orders failures worst first and sets score to the lowest quality', async () => {
    const r = await checkOcrReady(img.dark);
    const qualities = r.failures.map((f) => f.quality);
    expect(qualities).toEqual([...qualities].sort((a, b) => a - b));
    expect(r.score).toBe(Math.min(...r.checks.map((c) => c.quality)));
  });

  it('skips checks', async () => {
    const r = await checkOcrReady(img.skewed, { skip: ['skew'] });
    expect(r.ready).toBe(true);
    expect(r.checks.some((c) => c.check === 'skew')).toBe(false);
  });

  it('applies threshold overrides on top of the preset', async () => {
    const r = await checkOcrReady(img.skewed, { thresholds: { maxSkewAngle: 15 } });
    expect(r.ready).toBe(true);
    expect(r.thresholds.maxSkewAngle).toBe(15);
    expect(r.thresholds.minSharpness).toBe(PRESETS.document.minSharpness);
  });

  it('uses the receipt preset to tolerate more tilt', async () => {
    expect(await isOcrReady(img.skewed, { preset: 'receipt', thresholds: { maxSkewAngle: 10 } })).toBe(true);
    expect((await checkOcrReady(img.clean, { preset: 'a4-scan' })).preset).toBe('a4-scan');
  });

  it('reads file paths and Uint8Array input', async () => {
    const file = path.join(os.tmpdir(), `ocr-ready-${process.pid}.png`);
    await fs.writeFile(file, img.clean);
    try {
      expect(await isOcrReady(file)).toBe(true);
    } finally {
      await fs.unlink(file);
    }
    expect(await isOcrReady(new Uint8Array(img.clean))).toBe(true);
  });

  it('rejects bad input and options', async () => {
    await expect(checkOcrReady('')).rejects.toThrow(TypeError);
    await expect(checkOcrReady(42 as unknown as Buffer)).rejects.toThrow(TypeError);
    await expect(checkOcrReady(img.clean, { preset: 'nope' as never })).rejects.toThrow(/Unknown preset/);
    await expect(checkOcrReady(img.clean, { skip: ['nope' as never] })).rejects.toThrow(/Unknown check/);
    await expect(
      checkOcrReady(img.clean, { skip: ['sharpness', 'exposure', 'contrast', 'glare', 'shadow', 'skew'] }),
    ).rejects.toThrow(/At least one check/);
    expect(() => resolveThresholds('document', { maxGlare: 2 })).toThrow(RangeError);
    expect(() => resolveThresholds('document', { maxSkewAngle: 30 })).not.toThrow();
    expect(() => resolveThresholds('document', { bogus: 1 } as never)).toThrow(/Unknown threshold/);
  });
});
