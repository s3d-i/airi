import type { BrowserWindow } from 'electron'

import { defineInvokeHandler } from '@moeru/eventa'
import { createContext } from '@moeru/eventa/adapters/electron/main'
import { ipcMain } from 'electron'

import { windowDock } from '..'
import { DockController } from './controller'
import { createPlatformWindowTracker } from './native'

export interface WindowDockOptions {
  /**
   * Creates the overlay window that shows AIRI over the target window.
   *
   * Dock Mode calls it on the first start of a session, and destroys the window when the session ends.
   * The window must be hidden, transparent, and not focusable. Load its page before the promise resolves.
   *
   * If the creation takes longer than 30 s, Dock Mode aborts `signal` and the start fails.
   * On the abort, destroy the window. Dock Mode destroys a window that the promise gives after the abort.
   */
  createOverlayWindow: (signal: AbortSignal) => Promise<BrowserWindow>
}

export interface WindowDock {
  /** Removes the IPC handlers, ends the dock session, and destroys the overlay window. */
  dispose: () => void
}

/**
 * Sets up Dock Mode in the Electron main process and registers the `windowDock` invoke handlers.
 * Call it one time. Call `dispose` when the app quits.
 */
export function setupWindowDock(options: WindowDockOptions): WindowDock {
  const controller = new DockController({
    createOverlayWindow: options.createOverlayWindow,
    tracker: createPlatformWindowTracker(),
  })

  // A context without a window hears every renderer and replies to the sender.
  // The devtools page in the settings window controls the dock through it.
  const { context, dispose: disposeContext } = createContext(ipcMain)

  defineInvokeHandler(context, windowDock.listTargets, () => controller.listTargets())
  defineInvokeHandler(context, windowDock.start, ({ targetId }) => controller.start(targetId))
  defineInvokeHandler(context, windowDock.stop, () => controller.stop())
  defineInvokeHandler(context, windowDock.getDebugState, () => controller.getDebugState())
  defineInvokeHandler(context, windowDock.getConfig, () => controller.getConfig())
  defineInvokeHandler(context, windowDock.setConfig, config => controller.updateConfig(config))

  return {
    dispose() {
      disposeContext()
      controller.dispose()
    },
  }
}
