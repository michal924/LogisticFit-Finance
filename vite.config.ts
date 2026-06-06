import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { fileURLToPath } from 'node:url'

// Puste stuby dla opcjonalnych zależności jsPDF, których nie używamy
// (canvg/html2canvas/dompurify — wczytywane tylko przy doc.svg()/doc.html()).
const empty = fileURLToPath(new URL('./src/lib/empty-module.js', import.meta.url))

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      canvg: empty,
      html2canvas: empty,
      dompurify: empty,
    },
  },
})
