import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icons/icon.png', 'icons/icon-192.png', 'icons/icon-512.png', 'icons/logo.png'],
      manifest: {
        name: 'Comanda Digital',
        short_name: 'Comanda',
        description: 'PWA para atendimento de mesas do Comanda Digital.',
        theme_color: '#7C3AED',
        background_color: '#000000',
        display: 'standalone',
        start_url: '/',
        scope: '/',
        icons: [
          {
            src: '/icons/icon-192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any maskable'
          },
          {
            src: '/icons/icon-512.png',
            sizes: '512x512',
            type: 'image/png',
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
