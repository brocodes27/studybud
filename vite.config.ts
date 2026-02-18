import { defineConfig, type Plugin } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

/**
 * Custom plugin to clean up CJS patterns that slip through Rollup's
 * @rollup/plugin-commonjs. This happens when pre-bundled ESM files
 * (like @daily-co/daily-js/dist/daily-esm.js) internally embed CJS
 * fragments from their sub-dependencies (canvas renderers, lodash, etc).
 * Rollup marks these as ESM and skips CJS transformation.
 */
function cjsShimPlugin(): Plugin {
  return {
    name: 'cjs-shim',
    renderChunk(code) {
      const hasCjs = code.includes('module.exports') || code.includes('require(');
      if (!hasCjs) return null;

      // Inject module/exports shims at the top of the chunk.
      // This provides browser-safe globals for any embedded CJS fragments
      // that Rollup's commonjs plugin missed (e.g. code inside pre-bundled
      // ESM files like @daily-co/daily-js/dist/daily-esm.js).
      const shim = `var module=module||{exports:{}};var exports=module.exports;\n`;
      return { code: shim + code, map: null };
    },
  };
}

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
    }),
    cjsShimPlugin(),
  ],
  optimizeDeps: {
    exclude: ['lucide-react'],
    include: [
      '@vapi-ai/web',
      '@vapi-ai/web > events',
      '@vapi-ai/web > @daily-co/daily-js',
      '@daily-co/daily-js',
      'events',
    ],
  },
  define: {
    global: 'globalThis',
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
  },
  build: {
    target: 'esnext',
    minify: 'esbuild',
    commonjsOptions: {
      include: [/node_modules/],
      transformMixedEsModules: true,
      requireReturnsDefault: 'auto',
    },
    rollupOptions: {
      output: {
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