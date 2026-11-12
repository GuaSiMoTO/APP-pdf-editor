import basicSsl from '@vitejs/plugin-basic-ssl'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// HTTPS es obligatorio: Safari en iOS solo permite getUserMedia (cámara) en contextos seguros,
// y el iPhone accede al PC por la IP de la red local.
export default defineConfig({
  plugins: [
    react(),
    basicSsl(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.ico', 'apple-touch-icon-180x180.png', 'logo.svg', 'wordmark.png'],
      manifest: {
        name: 'Folio',
        short_name: 'Folio',
        description: 'Escanea, firma y edita tus documentos',
        lang: 'es',
        theme_color: '#1f2937',
        background_color: '#111827',
        display: 'standalone',
        icons: [
          { src: 'pwa-64x64.png', sizes: '64x64', type: 'image/png' },
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-icon-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // opencv.js (~15,5 MB) y el worker de pdf.js son grandes; se precachean para usar el escáner sin conexión
        maximumFileSizeToCacheInBytes: 25 * 1024 * 1024,
        navigateFallbackDenylist: [/^\/api\//],
      },
    }),
  ],
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
  preview: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8000',
    },
  },
})
