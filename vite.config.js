import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  server: {
    proxy: {
      '/candidate-assessments': {
        target: 'https://respond-io-fe-bucket.s3.ap-southeast-1.amazonaws.com',
        changeOrigin: true,
      },
    },
  },
  test: {
    environment: 'jsdom',
  },
})
