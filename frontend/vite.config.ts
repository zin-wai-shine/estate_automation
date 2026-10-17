import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5174,
    host: true,
    allowedHosts: true,
    watch: {
      usePolling: true,
      interval: 100,
    },
    proxy: {
      '/api': {
        target: process.env.VITE_BACKEND_TARGET || 'http://localhost:8085',
        changeOrigin: true,
      },
      '/storage': {
        target: process.env.VITE_BACKEND_TARGET || 'http://localhost:8085',
        changeOrigin: true,
      },
    },
  },
})
