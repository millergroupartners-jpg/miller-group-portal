import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Honor the harness-assigned port (falls back to Vite's default 5173)
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
  },
})
