import { defineConfig } from 'vite';

export default defineConfig({
  // GitHub Pages serves project sites below the repository name.
  // Keep the local development and preview address at the root by default.
  base: process.env.PAGES_BASE_PATH || '/',
  // Serve the native ESM modules directly, avoiding Windows cache rename locks.
  optimizeDeps: { noDiscovery: true, include: [] },
  // Avoid Node's recursive directory cleanup failure on this Windows Unicode path.
  // Vite replaces index.html and writes content-addressed assets on each build.
  build: { emptyOutDir: false },
});
