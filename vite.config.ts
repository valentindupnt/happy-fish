import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// NEXT_PUBLIC_ : noms des variables publiques créées par l'intégration Supabase de Vercel
export default defineConfig({
  plugins: [react()],
  envPrefix: ['VITE_', 'NEXT_PUBLIC_'],
  test: {
    testTimeout: 60000,
  },
})
