import { resolve } from 'node:path'

import Unocss from 'unocss/vite'
import Vue from 'unplugin-vue/vite'
import VueDevTools from 'vite-plugin-vue-devtools'

import { defineConfig } from 'vite'

export default defineConfig({
  resolve: {
    alias: {
      '@proj-airi/sherpa-onnx-esm': resolve(import.meta.dirname),
    },
  },
  build: {
    outDir: resolve(import.meta.dirname, 'playground', 'dist'),
  },
  plugins: [
    Vue(),
    // https://github.com/antfu/unocss
    // see uno.config.ts for config
    Unocss(),
    VueDevTools(),
  ],
})
