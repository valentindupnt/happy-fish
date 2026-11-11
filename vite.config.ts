import { defineConfig } from 'vite'
import type { Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// Numéro de version de chaque mise en ligne : l'app ouverte le compare à /version.json
const BUILD_ID = String(Date.now())
const versionFile = (): Plugin => ({
  name: 'hf-version-file',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ id: BUILD_ID }) })
  },
})

// NEXT_PUBLIC_ : noms des variables publiques créées par l'intégration Supabase de Vercel
export default defineConfig({
  plugins: [react(), versionFile()],
  define: { __BUILD_ID__: JSON.stringify(BUILD_ID) },
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  test: {
    testTimeout: 60000,
  },
})
