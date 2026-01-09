import process from 'node:process'

import { spawn } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

// Run electron-vite dev without Windows batch shims so Ctrl+C reliably stops the whole tree.
const require = createRequire(import.meta.url)

const electronViteBin = resolve(
  dirname(require.resolve('electron-vite/package.json')),
  'bin',
  'electron-vite.js',
)

const here = dirname(fileURLToPath(import.meta.url))
const cwd = resolve(here, '..')
const args = ['dev', ...process.argv.slice(2)]

const child = spawn(process.execPath, [electronViteBin, ...args], {
  cwd,
  stdio: 'inherit',
  env: { ...process.env },
  detached: process.platform !== 'win32',
})

let shuttingDown = false

function exitParent(code) {
  process.exit(code)
}

function terminateChildTree(exitCode = 0) {
  if (shuttingDown) {
    return
  }

  shuttingDown = true

  const handleChildExit = (code, signal) => {
    exitParent(code ?? (signal ? 1 : exitCode))
  }

  if (child.exitCode !== null) {
    exitParent(child.exitCode ?? exitCode)
    return
  }

  child.once('exit', handleChildExit)

  if (process.platform === 'win32') {
    const killer = spawn('taskkill', ['/pid', String(child.pid), '/T', '/F'], {
      stdio: 'inherit',
    })

    killer.once('error', () => {
      child.kill('SIGTERM')
    })
    return
  }

  const pid = child.pid

  if (pid) {
    try {
      process.kill(-pid, 'SIGTERM')
      return
    }
    catch {}
  }

  child.kill('SIGTERM')
}

child.on('exit', (code, signal) => {
  if (shuttingDown) {
    return
  }

  exitParent(code ?? (signal ? 1 : 0))
})

child.on('error', (error) => {
  console.error('Failed to start electron-vite dev:', error)
  exitParent(1)
})

for (const signal of ['SIGINT', 'SIGTERM', 'SIGBREAK']) {
  process.on(signal, () => terminateChildTree(0))
}

process.on('uncaughtException', (error) => {
  console.error(error)
  terminateChildTree(1)
})
