import { builtinModules } from 'node:module'
import { join } from 'node:path'

import { defineConfig } from 'rolldown'
import { esmExternalRequirePlugin } from 'rolldown/experimental'

export default defineConfig({
  input: [
    'src/sherpa-onnx/index.js',
    'src/sherpa-onnx/sherpa-onnx-asr.js',
    'src/sherpa-onnx/sherpa-onnx-kws.js',
    'src/sherpa-onnx/sherpa-onnx-speaker-diarization.js',
    'src/sherpa-onnx/sherpa-onnx-speech-enhancement.js',
    'src/sherpa-onnx/sherpa-onnx-tts.js',
    'src/sherpa-onnx/sherpa-onnx-vad.js',
    'src/sherpa-onnx/sherpa-onnx-wasm-nodejs.js',
    'src/sherpa-onnx/sherpa-onnx-wave.js',
  ],
  output: {
    dir: 'dist',
    format: 'esm',
  },
  plugins: [
    esmExternalRequirePlugin(),
    {
      name: 'copy',
      async buildEnd() {
        await this.fs.copyFile(join('src', 'sherpa-onnx', 'sherpa-onnx-wasm-nodejs.wasm'), join('dist', 'sherpa-onnx-wasm-nodejs.wasm'))
      },
    },
  ],
  platform: 'neutral',
  external: [
    ...builtinModules,
  ],
})
