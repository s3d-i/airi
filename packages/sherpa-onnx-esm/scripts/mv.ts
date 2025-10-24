import { copyFile, mkdir, readdir, rmdir } from 'node:fs/promises'
import { join } from 'node:path'

await rmdir(join('src', 'sherpa-onnx'), { recursive: true }).catch(() => {})
await mkdir(join('src', 'sherpa-onnx'))

const files = await readdir(join('node_modules', 'sherpa-onnx'))
for (const file of files) {
  if (file === 'package.json') {
    continue
  }

  await copyFile(join('node_modules', 'sherpa-onnx', file), join('src', 'sherpa-onnx', file))
}
