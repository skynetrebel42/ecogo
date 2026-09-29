import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

// Relative asset paths: the same build works at https://skynetrebel42.github.io/ecogo/ (GitHub Pages) and locally.
// There is no client-side router, so no 404 fallback is needed.
export default defineConfig({
  base: './',
  plugins: [react(), tailwindcss()],
})
