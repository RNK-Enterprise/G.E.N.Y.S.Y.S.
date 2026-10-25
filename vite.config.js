/**
 * GENYSYS™ — Vite config
 * Copyright © 2026 Asgard Innovations / RNK™. All Rights Reserved.
 *
 * `newtab.html` and `camofox.html` are explicit inputs: Rust tab windows load
 * them as internal surfaces, and the blocked/locked views depend on newtab.
 * Without these inputs the packaged app ships no tab surface.
 */

import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  root: 'src',
  publicDir: resolve(__dirname, 'public'),
  clearScreen: false,
  server: {
    host: '127.0.0.1',
    port: 1420,
    strictPort: true,
  },
  envPrefix: ['VITE_', 'TAURI_'],
  build: {
    outDir: resolve(__dirname, 'dist'),
    emptyOutDir: true,
    target: ['es2021', 'chrome100', 'safari13'],
    minify: !process.env.TAURI_DEBUG ? 'esbuild' : false,
    sourcemap: !!process.env.TAURI_DEBUG,
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'src/index.html'),
        newtab: resolve(__dirname, 'src/newtab.html'),
        camofox: resolve(__dirname, 'src/camofox.html'),
      },
    },
  },
});
