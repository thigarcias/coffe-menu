import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// base relativo: o build abre em qualquer pasta (e como Artifact do claude.ai)
export default defineConfig({
  base: './',
  plugins: [react()],
})
