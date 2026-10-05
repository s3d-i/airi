import type { Rectangle } from 'electron'

import { defineInvokeEventa } from '@moeru/eventa'

/**
 * - `detached`: no session. A caller stopped Dock Mode, or it never started.
 * - `companion`: the target is hidden or minimized. When the target is lost, the session also ends in this state.
 * - `docking-attached-visible`: the overlay is on the target.
 * - `docking-attached-hidden`: the session continues, but the target is fullscreen or not frontmost.
 */
export type DockModeState
  = | 'detached'
    | 'companion'
    | 'docking-attached-visible'
    | 'docking-attached-hidden'

/**
 * Percent-based viewport inside the target window.
 * Values are normalized between 0 (start/top/left) and 1 (end/bottom/right).
 */
export interface DockViewport {
  left: number
  right: number
  top: number
  bottom: number
}

export interface DockConfig {
  activeIntervalMs?: number
  hiddenIntervalMs?: number
  burstIntervalMs?: number
  burstTicks?: number
  clickThrough?: boolean
  padding?: number
  hideWhenInactive?: boolean
  /**
   * If true, keep the overlay visible even when the target window is not frontmost.
   * Fullscreen/hidden/minimized checks still apply.
   */
  showWhenNotFrontmost?: boolean
  /**
   * Restrict the overlay to a sub-rectangle of the target window (percentages 0–1).
   */
  viewport?: DockViewport
}

export const defaultDockConfig: Required<DockConfig> = {
  activeIntervalMs: 80,
  hiddenIntervalMs: 1000,
  burstIntervalMs: 40,
  burstTicks: 3,
  clickThrough: true,
  padding: 0,
  hideWhenInactive: true,
  showWhenNotFrontmost: false,
  viewport: {
    left: 0,
    right: 1,
    top: 0,
    bottom: 1,
  },
}

export interface WindowTargetSummary {
  id: string
  title?: string
  appName?: string
  ownerPid?: number
  layer?: number
  isOnScreen: boolean
  isMinimized?: boolean
  isFullscreen?: boolean
  bounds: Rectangle
  displayBounds?: Rectangle
}

export interface StartDockRequest {
  targetId: string
}

export interface DockDebugState {
  state: DockModeState
  targetId?: string
  /** The delay before the next tick. It is 0 when no session runs. */
  pollIntervalMs: number
  lastReason?: string
  lastMeta?: WindowTargetSummary
  windowsAbove?: number
  lastUpdatedAt: number
}

export const windowDockListTargets = defineInvokeEventa<WindowTargetSummary[], void>('eventa:invoke:electron:window-dock:list-targets')
export const windowDockStart = defineInvokeEventa<DockDebugState, StartDockRequest>('eventa:invoke:electron:window-dock:start')
export const windowDockStop = defineInvokeEventa<DockDebugState, void>('eventa:invoke:electron:window-dock:stop')
export const windowDockGetDebugState = defineInvokeEventa<DockDebugState, void>('eventa:invoke:electron:window-dock:get-debug-state')
export const windowDockSetConfig = defineInvokeEventa<DockDebugState, DockConfig>('eventa:invoke:electron:window-dock:set-config')

export const windowDock = {
  listTargets: windowDockListTargets,
  start: windowDockStart,
  stop: windowDockStop,
  getDebugState: windowDockGetDebugState,
  setConfig: windowDockSetConfig,
}
