import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import { resolve } from 'path';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  build: {
    outDir: 'dist-extension',
    emptyOutDir: false,
    cssCodeSplit: false,
    lib: {
      entry: resolve(__dirname, 'src/content/index.tsx'),
      formats: ['iife'],
      name: 'CaptureInsightContent',
      fileName: () => 'content/index.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        assetFileNames: 'content/[name][extname]'
      }
    },
    target: 'esnext',
    minify: false,
    sourcemap: true
  },
  define: {
    'process.env.NODE_ENV': JSON.stringify('production')
  }
});
