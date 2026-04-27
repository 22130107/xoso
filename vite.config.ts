import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  server: {
    proxy: process.env.NODE_ENV === 'development' ? {
      '/api': 'http://localhost:3001',
    } : undefined,
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ['react', 'react-dom'],
          cheerio: ['cheerio']
        }
      }
    },
    // Enable gzip compression
    minify: 'terser',
    terserOptions: {
      compress: {
        drop_console: true,
        drop_debugger: true
      }
    },
    // Optimize chunk size
    chunkSizeWarningLimit: 1000,
    // Enable CSS code splitting
    cssCodeSplit: true,
    // Generate source maps for debugging
    sourcemap: false,
    // Optimize assets
    assetsInlineLimit: 4096
  },
  // SEO optimizations
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version),
  },
  // Optimize dependencies
  optimizeDeps: {
    include: ['react', 'react-dom', 'cheerio'],
    exclude: []
  }
})
