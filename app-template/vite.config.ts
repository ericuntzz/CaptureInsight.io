import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'path';
import type { Connect } from 'vite';

// History API fallback middleware for SPA routing
function historyApiFallback(): Connect.NextHandleFunction {
  return (req, res, next) => {
    if (req.method !== 'GET') {
      return next();
    }

    const url = req.url || '/';

    if (
      url.startsWith('/api/') ||
      url.startsWith('/@') ||
      url.startsWith('/node_modules/') ||
      url.includes('.')
    ) {
      return next();
    }

    req.url = '/index.html';
    next();
  };
}

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'spa-fallback',
      configureServer(server) {
        server.middlewares.use(historyApiFallback());
      },
    },
  ],
  appType: 'spa',
  resolve: {
    extensions: ['.js', '.jsx', '.ts', '.tsx', '.json'],
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    target: 'esnext',
    outDir: 'build',
  },
  server: {
    middlewareMode: false,
    hmr: {
      protocol: 'wss',
      host: process.env.REPLIT_DOMAIN || 'localhost',
      port: 443,
    },
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: false,
        secure: false,
        headers: {
          'X-Forwarded-Host': process.env.REPLIT_DEV_DOMAIN || 'localhost:5000',
        },
      },
    },
  },
  preview: {
    host: '0.0.0.0',
    port: 5000,
    allowedHosts: true,
    proxy: {
      '/api': {
        target: 'http://localhost:3001',
        changeOrigin: false,
        secure: false,
      },
    },
  },
});
