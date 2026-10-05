import type { WindowMeta } from '../window-tracker'

import process from 'node:process'

import { app, BrowserWindow } from 'electron'

import { getDisplayBounds } from '../display'
import { ELECTRON_WINDOW_ID_PREFIX, toElectronWindowId } from '../window-ids'

export function collectElectronWindows(): WindowMeta[] {
  return BrowserWindow.getAllWindows()
    .filter(window => !window.isDestroyed())
    .map(windowToMeta)
}

export function getWindowsAboveElectronTarget(windowId: string, windows: WindowMeta[]): WindowMeta[] {
  const target = windows.find(window => window.id === windowId)
  if (!target) {
    return []
  }

  const candidates: WindowMeta[] = []
  const focused = BrowserWindow.getFocusedWindow()
  if (!focused || focused.isDestroyed()) {
    return [createExternalFrontmostMeta(target)]
  }

  if (focused && !focused.isDestroyed() && toElectronWindowId(focused.id) !== windowId) {
    candidates.push(windowToMeta(focused))
  }

  const targetBrowserWindow = resolveBrowserWindow(windowId)
  const targetAlwaysOnTop = targetBrowserWindow?.isAlwaysOnTop() ?? false
  if (!targetAlwaysOnTop) {
    for (const meta of windows) {
      if (meta.id === windowId) {
        continue
      }
      const candidate = resolveBrowserWindow(meta.id)
      if (candidate && !candidate.isDestroyed() && candidate.isAlwaysOnTop() && candidate.isVisible()) {
        candidates.push(meta)
      }
    }
  }

  const deduped = new Map<string, WindowMeta>()
  for (const meta of candidates) {
    deduped.set(meta.id, meta)
  }
  return Array.from(deduped.values())
}

function windowToMeta(window: BrowserWindow): WindowMeta {
  const bounds = window.getBounds()
  return {
    id: toElectronWindowId(window.id),
    title: window.getTitle(),
    appName: app.name,
    ownerPid: process.pid,
    layer: 0,
    isOnScreen: window.isVisible(),
    isMinimized: window.isMinimized(),
    isFullscreen: window.isFullScreen(),
    bounds,
    displayBounds: getDisplayBounds(bounds),
  }
}

function createExternalFrontmostMeta(target: WindowMeta): WindowMeta {
  const bounds = target.displayBounds ?? target.bounds
  return {
    ...target,
    id: 'external:frontmost',
    title: 'Frontmost window',
    appName: 'external',
    ownerPid: undefined,
    layer: 0,
    isOnScreen: true,
    isMinimized: false,
    isFullscreen: false,
    bounds,
    displayBounds: bounds,
  }
}

function resolveBrowserWindow(metaId: string): BrowserWindow | undefined {
  const parsedId = parseElectronId(metaId)
  return typeof parsedId === 'number' ? BrowserWindow.fromId(parsedId) ?? undefined : undefined
}

function parseElectronId(windowId: string): number | undefined {
  if (!windowId.startsWith(ELECTRON_WINDOW_ID_PREFIX)) {
    return undefined
  }
  const raw = Number.parseInt(windowId.slice(ELECTRON_WINDOW_ID_PREFIX.length), 10)
  return Number.isFinite(raw) ? raw : undefined
}
