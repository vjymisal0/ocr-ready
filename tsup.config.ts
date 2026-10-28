import { defineConfig } from 'tsup';

export default defineConfig([
  {
    entry: ['src/index.ts'],
    format: ['esm', 'cjs'],
    dts: true,
    clean: true,
    sourcemap: true,
    splitting: false,
    treeshake: true,
    minify: false,
    target: 'node20',
    outDir: 'dist',
  },
  {
    entry: ['src/cli.ts'],
    format: ['esm'],
    sourcemap: true,
    splitting: false,
    minify: false,
    target: 'node20',
    outDir: 'dist',
    banner: { js: '#!/usr/bin/env node' },
  },
]);
