import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react-swc'

export default defineConfig({
  plugins: [react()],
  resolve: {
    dedupe: ['react', 'react-dom', 'leaflet', 'react-leaflet'],
  },
  server: {
    port: 5173,
    host: true,
    strictPort: true,
    proxy: {
      '/api': {
        target: 'http://127.0.0.1:4000',
        changeOrigin: true,
        secure: false,
      }
    }
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: (id) => {
          // 📦 Group React and Leaflet together to avoid circular loops
          if (id.includes('node_modules')) {
            if (id.includes('react') || id.includes('leaflet')) {
              return 'vendor';
            }
            // 🤖 Keep Gemini AI separate (it's a heavy dependency)
            if (id.includes('@google/genai')) {
              return 'ai';
            }
          }
        }
      }
    }
  }
})