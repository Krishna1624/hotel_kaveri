import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'static',
    emptyOutDir: true,
    cssCodeSplit: true,
    chunkSizeWarningLimit: 600,
    target: 'es2020',
    minify: 'esbuild',
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules')) {
            if (id.includes('recharts') || id.includes('d3-')) {
              return 'vendor-charts';
            }
            if (id.includes('lucide-react')) {
              return 'vendor-icons';
            }
          }
        }
      }
    }
  },
  server: {
    port: 3000,
    proxy: {
      '/auth': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/properties': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/bookings': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/guests': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/reports': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/reviews': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/rates': { target: 'http://127.0.0.1:8000', changeOrigin: true },
      '/health': { target: 'http://127.0.0.1:8000', changeOrigin: true },
    }
  }
});
