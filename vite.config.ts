/// <reference types="vitest/config" />
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import type { Plugin } from 'vite';

/** Lists every built file in /precache.json, for the service worker to cache on install. */
function precacheList(): Plugin {
  return {
    name: 'precache-list',
    apply: 'build',
    generateBundle(_, bundle) {
      const files = Object.keys(bundle).filter((f) => !f.endsWith('.map') && f !== 'index.html').map((f) => `/${f}`);
      this.emitFile({ type: 'asset', fileName: 'precache.json', source: JSON.stringify(files) });
    },
  };
}

export default defineConfig({
  plugins: [react(), precacheList()],
  // A new id per build: the page registers the service worker under it, so each release updates it.
  define: { __BUILD_ID__: JSON.stringify(Date.now().toString(36)) },
  build: {
    rolldownOptions: {
      output: {
        // React on its own, so the front page doesn't wait for 3D code; three.js and its React
        // bindings in chunks of their own, which change rarely and stay cached across releases.
        advancedChunks: {
          groups: [
            { name: 'react', test: /node_modules[\\/](react|react-dom|scheduler|zustand|use-sync-external-store)[\\/]/, priority: 30 },
            { name: 'three', test: /node_modules[\\/](three|three-stdlib)[\\/]/, priority: 20 },
            { name: 'r3f', test: /node_modules[\\/](@react-three|maath|troika-[^\\/]+|camera-controls|meshline|its-fine|suspend-react|@monogrid|@use-gesture|stats-gl|detect-gpu|hls\.js|tunnel-rat)[\\/]/, priority: 10 },
            { name: 'gsap', test: /node_modules[\\/]gsap[\\/]/, priority: 10 },
          ],
        },
      },
    },
  },
  test: { include: ['tests/**/*.test.ts'] },
});
