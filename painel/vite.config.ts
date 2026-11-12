import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Em desenvolvimento, /api vai para a API do painel rodando no compose (PAINEL_URL),
// com o login do .env (PAINEL_AUTH=usuario:senha) para o navegador não pedir.
export default defineConfig({
  plugins: [react()],
  resolve: { alias: { '@': '/src' } },
  server: {
    port: 5196,
    proxy: { '/api': { target: process.env.PAINEL_URL || 'http://localhost:5195', changeOrigin: true, auth: process.env.PAINEL_AUTH } },
  },
})
