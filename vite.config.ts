import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      strategies: 'injectManifest',
      srcDir: 'src',
      filename: 'sw.ts',
      registerType: 'autoUpdate',
      // We register via `virtual:pwa-register` in src/sw-update.ts
      injectRegister: null,
      devOptions: { enabled: false },
      includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'masked-icon.svg'],
      manifest: {
        name: 'elevenfolks',
        short_name: 'elevenfolks',
        description: 'AI-powered study companion for personalized learning',
        theme_color: '#3B82F6',
        background_color: '#1F2937',
        display: 'standalone',
        orientation: 'portrait',
        scope: '/',
        start_url: '/',
        icons: [
          {
            src: 'pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png'
          },
          {
            src: 'pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any maskable'
          }
        ]
      },
      injectManifest: {
        globPatterns: ['**/*.{js,css,html,ico,png,svg,webmanifest}'],
      },
    })
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: ['@vapi-ai/web', 'events', '@daily-co/daily-js'],
  },
  server: {
    port: 5173,
    host: true,
    strictPort: false,
    cors: true,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,HEAD,PUT,PATCH,POST,DELETE',
      'Access-Control-Allow-Headers': 'Origin, X-Requested-With, Content-Type, Accept, Authorization',
    },
    fs: {
      // Ensure sw.js is served with the correct MIME type
      allow: ['..'],
    },
    middlewareMode: false,
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        if (req.url === '/sw.js') {
          res.setHeader('Content-Type', 'application/javascript');
        }
        next();
      });
    },
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
    },
    rollupOptions: {
      output: {
        format: 'es',
        entryFileNames: 'assets/[name]-[hash].js',
        chunkFileNames: 'assets/[name]-[hash].js',
        assetFileNames: 'assets/[name]-[hash].[ext]'
      }
    }
  },
  esbuild: {
    target: 'esnext'
  }
});