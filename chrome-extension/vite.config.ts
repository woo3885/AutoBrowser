import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  base: './',
  plugins: [react()],
  css: {
    postcss: { plugins: [] }
  },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    sourcemap: false,
    lib: {
      entry: 'src/floating.tsx',
      name: 'AutoBrowserFloatingPanel',
      formats: ['iife'],
      fileName: () => 'floating-panel.js'
    }
  }
});
