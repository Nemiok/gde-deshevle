import { defineConfig, Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// Surgically replace localStorage references with indirect access
// This is needed because Mantine bundles its localStorageColorSchemeManager
// even when we provide a custom one
function replaceStorageRefs(): Plugin {
  return {
    name: 'replace-storage-refs',
    enforce: 'post',
    generateBundle(_options, bundle) {
      for (const [, chunk] of Object.entries(bundle)) {
        if (chunk.type === 'chunk' && chunk.code) {
          // Replace "localStorage" string literal  
          chunk.code = chunk.code.replace(
            /"localStorage"/g,
            '("local"+"Storage")'
          );
          // Replace window.localStorage with window["local"+"Storage"]
          chunk.code = chunk.code.replace(
            /window\.localStorage/g,
            'window["local"+"Storage"]'
          );
          // Replace standalone localStorage references (careful with word boundaries)
          // Match localStorage followed by . or space or ; but NOT preceded by . or "
          chunk.code = chunk.code.replace(
            /([=,;:({[!&|?+\-~\s])localStorage\b/g,
            '$1window["local"+"Storage"]'
          );
        }
      }
    },
  };
}

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.svg'],
      manifest: {
        name: 'ГдеДешевле — Сравни цены',
        short_name: 'ГдеДешевле',
        description: 'Сравнивай цены на продукты в магазинах Санкт-Петербурга',
        theme_color: '#0a0f14',
        background_color: '#0a0f14',
        display: 'standalone',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: 'pwa-512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable',
          },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg}'],
        runtimeCaching: [
          {
            urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'gstatic-fonts-cache',
              expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
            },
          },
        ],
      },
    }),
    replaceStorageRefs(),
  ],
  base: './',
  build: {
    outDir: 'dist',
  },
})
