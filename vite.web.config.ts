import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { allowViteDevelopmentStyles } from './src/build/web-development-csp'

const developmentCspPlugin: Plugin = {
  name: 'mqttape-web-development-csp',
  apply: 'serve',
  enforce: 'pre',
  transformIndexHtml: allowViteDevelopmentStyles
}

export default defineConfig({
  root: 'src/renderer',
  base: './',
  plugins: [developmentCspPlugin, react()],
  resolve: {
    alias: {
      '@renderer': resolve('src/renderer/src'),
      '@shared': resolve('src/shared')
    }
  },
  build: {
    outDir: resolve('dist-web'),
    emptyOutDir: true
  }
})
