import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig({
  plugins: [
    react(),
    {
      name: 'html-env-replace',
      transformIndexHtml(html) {
        return html.replace(/%(\w+)%/g, (_, key) => process.env[key] ?? '')
      },
    },
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),           // Assembled src
      '@core': path.resolve(__dirname, './core/src'),  // Core source
      '@custom': path.resolve(__dirname, './custom'), // Custom apps directory
    },
  },
  server: {
    port: 5173,
  },
  build: {
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
})
