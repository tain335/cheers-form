import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue';
import react from '@vitejs/plugin-react'
import commonjs from 'vite-plugin-commonjs'
// https://vitejs.dev/config/
export default defineConfig({
  plugins: [vue(), react(),commonjs()],
  optimizeDeps:{},
  resolve: {
    alias: {
      '@src': '/src'
    },
  },
  server: {
    open: '/react.html',
    port: 3000
  }
})