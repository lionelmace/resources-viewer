import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/iam': {
        target: 'https://iam.cloud.ibm.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/iam/, ''),
        secure: false
      },
      '/api': {
        target: 'https://eu-de.apprapp.cloud.ibm.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, ''),
        secure: false
      },
      '/resources': {
        target: 'https://resource-controller.cloud.ibm.com',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/resources/, ''),
        secure: false
      }
    }
  }
})
