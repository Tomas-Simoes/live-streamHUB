import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import tsconfigPaths from 'vite-tsconfig-paths'
import path from 'path'
import { fileURLToPath } from 'url';


const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);


export default defineConfig({
  root: path.resolve(__dirname),

  build: {
    outDir: 'dist',
  },

  publicDir: path.resolve(__dirname, '../frontend/public/assets'),

  server: {
    port: 5173,
    fs: {
      strict: false,
      allow: ['.']
    },
  },

  plugins: [
    react(),
    tailwindcss(),
    tsconfigPaths(),
  ],

  base: '',

  assetsInclude: ['../src/assets/*'],

  resolve: {
    alias: {
      '@web': path.resolve(__dirname, '../web'),
      '@frontend': path.resolve(__dirname, '../frontend')
    },
    dedupe: ['react', 'react-dom']
  },
  optimizeDeps: {
    include: ['react', 'react-dom'],
    esbuildOptions: {
      preserveSymlinks: false
    }
  }
})
