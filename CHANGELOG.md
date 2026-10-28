# Changelog

## 0.1.0

- Initial release: `checkOcrReady` and `isOcrReady` run sharpness, exposure, contrast, glare, shadow and skew checks in one call.
- Presets `document`, `kyc-id`, `receipt` and `a4-scan`, with per-threshold overrides and `skip`.
- Exposure and shadow checks tuned so white paper and text lines are not flagged.
- `ocr-ready` CLI with human and `--json` output.
