import process from 'node:process'

import { spawnSync } from 'node:child_process'

const isWindows = process.platform === 'win32'

if (!isWindows) {
  console.info('[win32-window-bindings] Skipping native build (platform is not win32)')
  process.exit(0)
}

const pnpmCmd = process.platform === 'win32' ? 'pnpm.cmd' : 'pnpm'

const result = spawnSync(
  pnpmCmd,
  ['dlx', '@napi-rs/cli@2.18.0', 'build', '--platform', '--release'],
  {
    stdio: 'inherit',
    env: process.env,
  },
)

if (result.error) {
  console.error('[win32-window-bindings] Failed to spawn `napi` CLI:', result.error)
  process.exit(result.status ?? 1)
}

if (result.status !== 0) {
  process.exit(result.status ?? 1)
}
