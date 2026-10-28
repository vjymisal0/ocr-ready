import { parseArgs } from 'node:util';
import { checkOcrReady, PRESETS } from './index';
import type { CheckName, OcrReadyResult, PresetName } from './types';

const USAGE = `Usage: ocr-ready [options] <image...>

Checks document photos for blur, exposure, contrast, glare, shadow and skew.

Options:
  -p, --preset <name>   ${Object.keys(PRESETS).join(' | ')} (default: document)
  -s, --skip <checks>   Comma-separated checks to skip, e.g. skew,shadow
      --json            Print results as JSON
  -h, --help            Show this help

Exit codes: 0 all ready, 1 at least one image not ready, 2 usage or read error.`;

function printHuman(file: string, r: OcrReadyResult): void {
  console.log(`${r.ready ? 'READY    ' : 'NOT READY'} ${file} (score ${r.score.toFixed(2)})`);
  for (const c of r.checks) {
    console.log(`  ${c.pass ? 'ok  ' : 'FAIL'} ${c.message}`);
    if (c.hint) console.log(`       ${c.hint}`);
  }
}

async function main(): Promise<number> {
  let parsed;
  try {
    parsed = parseArgs({
      allowPositionals: true,
      options: {
        preset: { type: 'string', short: 'p' },
        skip: { type: 'string', short: 's' },
        json: { type: 'boolean' },
        help: { type: 'boolean', short: 'h' },
      },
    });
  } catch (err) {
    console.error((err as Error).message);
    console.error(USAGE);
    return 2;
  }
  const { values, positionals } = parsed;
  if (values.help) {
    console.log(USAGE);
    return 0;
  }
  if (positionals.length === 0) {
    console.error(USAGE);
    return 2;
  }

  const preset = values.preset as PresetName | undefined;
  const skip = values.skip
    ? (values.skip.split(',').map((s) => s.trim()).filter(Boolean) as CheckName[])
    : undefined;

  let code = 0;
  const results: Record<string, OcrReadyResult | { error: string }> = {};
  for (const file of positionals) {
    try {
      const r = await checkOcrReady(file, { preset, skip });
      results[file] = r;
      if (!values.json) printHuman(file, r);
      if (!r.ready && code === 0) code = 1;
    } catch (err) {
      const message = (err as Error).message;
      results[file] = { error: message };
      if (!values.json) console.error(`ERROR     ${file}: ${message}`);
      code = 2;
    }
  }
  if (values.json) console.log(JSON.stringify(results, null, 2));
  return code;
}

main().then((code) => {
  process.exitCode = code;
});
