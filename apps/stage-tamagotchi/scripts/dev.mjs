import process from 'node:process'

import { spawn } from 'node:child_process'

const envFlag = value => value === '1' || value?.toLowerCase() === 'true'

const isWindows = process.platform === 'win32'
const isInteractive = Boolean(process.stdin.isTTY && process.stdout.isTTY)
const forceInteractive = envFlag(process.env.FORCE_VITE_INTERACTIVE)
const forceNonInteractive = envFlag(process.env.FORCE_VITE_NON_INTERACTIVE)

const shouldDisableShortcuts = !forceInteractive && (forceNonInteractive || (isWindows && isInteractive))
const childEnv = { ...process.env }

if (shouldDisableShortcuts && !childEnv.CI)
  childEnv.CI = '1'

if (forceInteractive) {
  console.info('[stage-tamagotchi] FORCE_VITE_INTERACTIVE set; running dev server with Vite CLI shortcuts enabled.')
}
else if (forceNonInteractive) {
  console.info('[stage-tamagotchi] FORCE_VITE_NON_INTERACTIVE set; disabling Vite CLI shortcuts for dev server.')
}
else if (shouldDisableShortcuts) {
  console.info('[stage-tamagotchi] Detected interactive Windows terminal; running dev server with CI=1 to skip Vite CLI shortcuts (set FORCE_VITE_INTERACTIVE=1 to opt back in).')
}

// Prefer the exact pnpm entry used by the current lifecycle so we don't depend on shell lookup.
const npmExecPath = process.env.npm_execpath
const pnpmCommand = npmExecPath
  ? { command: process.execPath, args: [npmExecPath] }
  : { command: isWindows ? 'pnpm.cmd' : 'pnpm', args: [] }

const command = pnpmCommand.command
const args = [...pnpmCommand.args, 'run', 'dev:interactive']

const child = spawn(command, args, {
  env: childEnv,
  stdio: 'inherit',
  shell: !npmExecPath && isWindows,
})

function forwardSignal(signal) {
  if (!child.killed)
    child.kill(signal)
}

// Forward signals to child process
process.on('SIGINT', () => forwardSignal('SIGINT'))
process.on('SIGTERM', () => forwardSignal('SIGTERM'))

child.on('exit', (code, signal) => {
  if (signal) {
    process.exit(1)
  }

  process.exit(code ?? 1)
})

child.on('error', (error) => {
  console.error('[stage-tamagotchi] Failed to start dev server:', error)
  process.exit(1)
})
