import { defineConfig } from 'vite';
import { resolve } from 'path';

export default defineConfig({
  resolve: {
    alias: {
      '@shared': resolve(__dirname, 'src/shared')
    }
  },
  build: {
    outDir: 'dist-extension',
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/background/index.ts'),
      formats: ['es'],
      fileName: () => 'background/index.js'
    },
    rollupOptions: {
      output: {
        inlineDynamicImports: true
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
