import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: { host: '::', port: 8080 },
  preview: { host: '0.0.0.0' },
  plugins: [react(), tailwindcss()],
})
