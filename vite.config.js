import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'static',
    emptyOutDir: true,
    cssCodeSplit: false,
  },
  server: {
    port: 3000,
    proxy: {
      '/auth': 'http://127.0.0.1:8000',
      '/properties': 'http://127.0.0.1:8000',
      '/bookings': 'http://127.0.0.1:8000',
      '/guests': 'http://127.0.0.1:8000',
      '/reports': 'http://127.0.0.1:8000',
      '/reviews': 'http://127.0.0.1:8000'
    }
  }
});
