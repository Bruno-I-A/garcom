import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.svg', 'icons/icon-192.svg', 'icons/icon-512.svg'],
      manifest: {
        name: 'ShiftSys Garçom',
        short_name: 'Garçom',
        description: 'PWA para atendimento de mesas do ShiftSys.',
        theme_color: '#111827',
        background_color: '#111827',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.svg',
            sizes: '192x192',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.svg',
            sizes: '512x512',
            type: 'image/svg+xml',
            purpose: 'any maskable'
          }
        ]
      },
      workbox: {
        navigateFallback: '/index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://agentes-agente-restaurante.feit1k.easypanel.host',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'shiftsys-api',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 60,
                maxAgeSeconds: 60 * 10
              }
            }
          }
        ]
      }
    })
  ]
});
