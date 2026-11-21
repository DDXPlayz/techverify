import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // Production is served from tools.anantamracing.com/techverify/, so that is the
  // default and a normal build is unchanged. A bare clone served at the root
  // needs VITE_BASE=/ at build time, or every asset 404s.
  base: process.env.VITE_BASE ?? '/techverify/',
})
