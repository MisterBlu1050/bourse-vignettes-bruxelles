import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['icon.svg'],
      manifest: {
        name: 'Bourse aux vignettes Bruxelles',
        short_name: 'Bourse Vignettes',
        description: 'Des échanges de vignettes organisés entre parents à Bruxelles.',
        theme_color: '#17243b',
        background_color: '#f4efe5',
        display: 'standalone',
        lang: 'fr-BE',
        icons: [{ src: '/icon.svg', sizes: 'any', type: 'image/svg+xml', purpose: 'any maskable' }]
      }
    })
  ]
})
