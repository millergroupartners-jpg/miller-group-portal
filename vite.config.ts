import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    // Honor the harness-assigned port (falls back to Vite's default 5173)
    port: process.env.PORT ? Number(process.env.PORT) : 5173,
    // Plain `vite` doesn't run the /api serverless functions. Point API calls
    // at a running `vercel dev` (or prod) instance when needed:
    //   VITE_API_PROXY=http://localhost:3311 npm run dev
    proxy: process.env.VITE_API_PROXY
      ? { '/api': { target: process.env.VITE_API_PROXY, changeOrigin: true } }
      : undefined,
  },
})
