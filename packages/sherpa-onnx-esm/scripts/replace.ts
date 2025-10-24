import { readFile, writeFile } from 'node:fs/promises'
import { join } from 'node:path'

const fileContent = await readFile(join('src', 'index.js'), 'utf-8')
fileContent.replace(`const wasmModule = require('./sherpa-onnx-wasm-nodejs.js')();
const sherpa_onnx_asr = require('./sherpa-onnx-asr.js');
const sherpa_onnx_tts = require('./sherpa-onnx-tts.js');
const sherpa_onnx_kws = require('./sherpa-onnx-kws.js');
const sherpa_onnx_wave = require('./sherpa-onnx-wave.js');
const sherpa_onnx_vad = require('./sherpa-onnx-vad.js');
const sherpa_onnx_speaker_diarization =
    require('./sherpa-onnx-speaker-diarization.js');
const sherpa_onnx_speech_enhancement =
    require('./sherpa-onnx-speech-enhancement.js');

`, `const wasmModule = require('./sherpa-onnx-wasm-nodejs.js')();
const sherpa_onnx_asr = require('./sherpa-onnx-asr.js');
const sherpa_onnx_tts = require('./sherpa-onnx-tts.js');
const sherpa_onnx_kws = require('./sherpa-onnx-kws.js');
const sherpa_onnx_wave = require('./sherpa-onnx-wave.js');
const sherpa_onnx_vad = require('./sherpa-onnx-vad.js');
const sherpa_onnx_speaker_diarization =
    require('./sherpa-onnx-speaker-diarization.js');
const sherpa_onnx_speech_enhancement =
    require('./sherpa-onnx-speech-enhancement.js');

`)
