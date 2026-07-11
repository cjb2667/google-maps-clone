import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  // 相对路径基址:兼容 GitHub Pages 子路径部署(/google-maps-clone/)
  base: './',
  build: {
    rollupOptions: {
      output: {
        // 把 MapLibre 单独分包,业务代码更新时浏览器可继续缓存地图引擎
        manualChunks(id) {
          if (id.includes('node_modules/maplibre-gl')) return 'maplibre'
        },
      },
    },
  },
})
