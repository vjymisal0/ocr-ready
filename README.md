# ocr-ready 📄

[![npm version](https://img.shields.io/npm/v/ocr-ready.svg?style=flat-square)](https://www.npmjs.com/package/ocr-ready)
[![CI](https://github.com/vjymisal0/ocr-ready/actions/workflows/ci.yml/badge.svg)](https://github.com/vjymisal0/ocr-ready/actions/workflows/ci.yml)
[![license](https://img.shields.io/npm/l/ocr-ready.svg?style=flat-square)](https://github.com/vjymisal0/ocr-ready/blob/main/LICENSE)
[![Downloads](https://img.shields.io/npm/dm/ocr-ready.svg?style=flat-square)](https://www.npmjs.com/package/ocr-ready)

> One call to decide whether a document or ID photo is good enough for OCR. Runs six quality checks in parallel and returns **pass/fail**, the **reason** for each failure, and a **retake hint** you can show the user.

OCR engines (Tesseract, AWS Textract, Google Cloud Vision) rarely refuse a bad photo. They return wrong text instead. `ocr-ready` catches the photo before you pay for OCR, so you can ask the user to retake it while they still have the document in hand.

---

## Checks

| Check | Powered by | Fails when |
| --- | --- | --- |
| `sharpness` | [`blur-score`](https://www.npmjs.com/package/blur-score) | image is blurry or out of focus |
| `exposure` | [`exposure-score`](https://www.npmjs.com/package/exposure-score) | image is too dark or washed out |
| `contrast` | [`contrast-score`](https://www.npmjs.com/package/contrast-score) | text is faded against the background |
| `glare` | [`glare-score`](https://www.npmjs.com/package/glare-score) | flash or lamp reflection hides content |
| `shadow` | [`shadow-score`](https://www.npmjs.com/package/shadow-score) | a hand or phone shadow covers the page |
| `skew` | [`skew-score`](https://www.npmjs.com/package/skew-score) | page is tilted in the frame |

The exposure and shadow checks are tuned for paper: a bright white page is not counted as overexposed, and lines of text are not mistaken for shadow.

## Installation

```bash
npm install ocr-ready
```

Requires Node.js 20.9 or later. Image decoding uses [`sharp`](https://sharp.pixelplumbing.com/), which is installed with the checks.

## Usage

```ts
import { checkOcrReady } from 'ocr-ready';

const result = await checkOcrReady('./upload.jpg', { preset: 'kyc-id' });

if (!result.ready) {
  for (const failure of result.failures) {
    console.log(failure.message); // "glare 0.54 (max 0.1), 1 hotspot(s) covering 8.1%"
    console.log(failure.hint);    // "Light is reflecting off the surface. Turn off the flash..."
  }
}
```

CommonJS works too:

```js
const { isOcrReady } = require('ocr-ready');

if (!(await isOcrReady(buffer))) {
  // ask for a retake
}
```

### Input

A file path, a `Buffer`, or a `Uint8Array` containing any format `sharp` reads (JPEG, PNG, WebP, TIFF, AVIF, GIF, SVG). A path is read once, then all six checks share the bytes.

### Presets

| Preset | Use for | Sharpness ≥ | Exposure ≥ | Contrast ≥ | Glare ≤ | Shadow ≤ | Tilt ≤ |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `document` (default) | phone photo of a printed page | 0.40 | 0.50 | 0.30 | 0.15 | 0.30 | 3° |
| `kyc-id` | ID cards, passports | 0.50 | 0.55 | 0.35 | 0.10 | 0.25 | 5° |
| `receipt` | thermal receipts | 0.35 | 0.45 | 0.20 | 0.20 | 0.35 | 8° |
| `a4-scan` | flatbed or sheet-fed scans | 0.50 | 0.55 | 0.35 | 0.10 | 0.20 | 2° |

### Options

```ts
await checkOcrReady(input, {
  preset: 'receipt',
  thresholds: { maxSkewAngle: 12 }, // override any preset limit
  skip: ['skew'],                   // e.g. when your pipeline deskews anyway
});
```

### Result

```ts
{
  ready: false,
  score: 0.46,          // lowest per-check quality, 0 (worst) to 1 (best)
  preset: 'document',
  thresholds: { minSharpness: 0.4, /* ... */ },
  checks: [
    { check: 'sharpness', pass: true, value: 0.99, limit: 0.4, quality: 0.99, message: 'sharpness 0.99 (min 0.4)' },
    // ...
  ],
  failures: [
    { check: 'glare', pass: false, value: 0.54, limit: 0.15, quality: 0.46,
      message: 'glare 0.54 (max 0.15), 1 hotspot(s) covering 8.1%',
      hint: 'Light is reflecting off the surface. Turn off the flash and tilt the document away from the light.' },
  ],
}
```

- `value` is the score from the underlying package, or the tilt angle in degrees for `skew`.
- `quality` puts every check on one scale where 1 is best, so `score` and the order of `failures` (worst first) are comparable across checks.
- When `skew-score` cannot find text lines (for example a blank page), the skew check passes and its message says the tilt was not checked.

## CLI

```bash
npx ocr-ready scan1.jpg scan2.png
npx ocr-ready --preset kyc-id --skip skew --json id-front.jpg
```

```
NOT READY scan2.png (score 0.46)
  ok   sharpness 0.99 (min 0.4)
  ok   exposure 0.53 (min 0.5), mean brightness 198
  ok   contrast 1 (min 0.3)
  FAIL glare 0.54 (max 0.15), 1 hotspot(s) covering 8.1%
       Light is reflecting off the surface. Turn off the flash and tilt the document away from the light.
  ok   shadow 0.13 (max 0.3)
  ok   tilt 0° (max 3°)
```

Exit codes: `0` all images ready, `1` at least one image not ready, `2` usage or read error.

## License

MIT © Vijay Misal
