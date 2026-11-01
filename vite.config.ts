import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
  server: { host: '::', port: 8080 },
  preview: { host: '0.0.0.0' },
  // Aceita também os nomes no padrão da integração Supabase da Vercel (NEXT_PUBLIC_...).
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  plugins: [react(), tailwindcss()],
})
