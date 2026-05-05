import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'ACTIVITY_LOG_'],
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        manualChunks(id) {
          const normalizedId = id.replace(/\\/g, '/')

          if (!normalizedId.includes('/node_modules/')) return undefined

          if (
            normalizedId.includes('/node_modules/react/') ||
            normalizedId.includes('/node_modules/react-dom/') ||
            normalizedId.includes('/node_modules/scheduler/')
          ) {
            return 'react-vendor'
          }

          if (normalizedId.includes('/node_modules/react-router-dom/')) {
            return 'router-vendor'
          }

          if (normalizedId.includes('/node_modules/@supabase/')) {
            return 'supabase-vendor'
          }

          if (normalizedId.includes('/node_modules/lucide-react/')) {
            return 'icons-vendor'
          }

          return 'vendor'
        },
      },
    },
  },
})
