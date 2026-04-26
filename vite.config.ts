import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import tailwindcss from 'tailwindcss'
import autoprefixer from 'autoprefixer'

// Vite config for Spine v2 - v2-core as working root
export default defineConfig({
  plugins: [
    react(),
  ],

  // Root directory for the v2 app (v2-core is now the working root)
  root: path.resolve(__dirname, 'v2-core'),
  
  // Build configuration
  build: {
    outDir: path.resolve(__dirname, 'dist'),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        manualChunks: {
          'vendor-react': ['react', 'react-dom', 'react-router-dom'],
          'vendor-supabase': ['@supabase/supabase-js'],
          'vendor-ui': ['lucide-react', 'clsx', 'tailwind-merge', 'class-variance-authority'],
          'vendor-markdown': ['marked'],
        },
      },
    },
  },
  
  // Development server
  server: {
    port: 3001,
    host: true,
    proxy: {
      '/api': {
        target: 'http://localhost:8888',
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api\//, '/.netlify/functions/'),
      }
    }
  },
  
  // Resolve paths
  resolve: {
    alias: {
      '@': path.resolve(__dirname, 'v2-core/src'),
      '@shared': path.resolve(__dirname, 'v2-core/functions/_shared'),
      '@core': path.resolve(__dirname, 'v2-core/src'),
      '@custom': path.resolve(__dirname, 'v2-custom/src')
    }
  },
  
  // Environment variables
  define: {
    __V2__: 'true'
  },
  
  // Environment directory (project root)
  envDir: path.resolve(__dirname),
  
  // Explicitly configure PostCSS to use v2-core's tailwind config
  css: {
    postcss: {
      plugins: [
        tailwindcss({ config: path.resolve(__dirname, 'v2-core/tailwind.config.js') }),
        autoprefixer(),
      ],
    },
  },
})
