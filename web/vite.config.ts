import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';
import { readdirSync } from 'node:fs';

// The pictures family can choose from in the editor.
const symbols = readdirSync(new URL('./public/symbols', import.meta.url))
  .filter((f) => f.endsWith('.svg'))
  .map((f) => f.slice(0, -4))
  .sort();

export default defineConfig({
  // Relative paths, so the site works wherever it is hosted.
  base: './',
  define: { __SYMBOLS__: JSON.stringify(symbols) },
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,mp3,woff2}'],
        // The editor, Firebase library and voice model are only for family's
        // devices, so his phone does not download or store them.
        globIgnores: ['**/Editor-*', '**/voice-*', '**/kokoro-*', '**/*.wasm', '**/vision_bundle-*', '**/face-*', '**/photo-*'],
      },
      manifest: {
        name: 'Bro Board',
        short_name: 'Bro Board',
        description: 'Big buttons for saying what you need.',
        start_url: '.',
        scope: '.',
        display: 'standalone',
        background_color: '#f4efe6',
        theme_color: '#2e2924',
        icons: [
          { src: 'icon-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
    }),
  ],
  test: { include: ['tests/**/*.test.ts'] },
});
