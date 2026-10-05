import type { WindowDock } from '@proj-airi/electron-window-dock/main'

import type { I18n } from '../../libs/i18n'
import type { ServerChannel } from '../../services/airi/channel-server'

import { join, resolve } from 'node:path'

import { createContext } from '@moeru/eventa/adapters/electron/main'
import { setupWindowDock } from '@proj-airi/electron-window-dock/main'
import { BrowserWindow, ipcMain } from 'electron'
import { isMacOS } from 'std-env'

import icon from '../../../../resources/icon.png?asset'

import { onAppBeforeQuit } from '../../libs/bootkit/lifecycle'
import { baseUrl, getElectronMainDirname, load, withHashRoute } from '../../libs/electron/location'
import { protectPrivilegedWindowNavigation, setupBaseWindowElectronInvokes, transparentWindowConfig } from '../shared/window'

/**
 * Creates the overlay window of Dock Mode and loads its renderer.
 * The window stays hidden. The dock controller shows it on the target window.
 */
async function createDockOverlayWindow(params: { serverChannel: ServerChannel, i18n: I18n }): Promise<BrowserWindow> {
  const window = new BrowserWindow({
    title: 'AIRI Dock Overlay',
    width: 450,
    height: 600,
    show: false,
    focusable: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    icon,
    webPreferences: {
      preload: join(getElectronMainDirname(), '../preload/index.mjs'),
      sandbox: false,
    },
    // The same window type as the main window. See the references in `../main`.
    type: isMacOS ? 'panel' : undefined,
    ...transparentWindowConfig(),
  })

  window.setFullScreenable(false)
  window.setVisibleOnAllWorkspaces(true)
  if (isMacOS) {
    window.setWindowButtonVisibility(false)
  }
  protectPrivilegedWindowNavigation(window)

  try {
    // `onlySameWindow` hears only this window and disposes with it. Without it, the base handlers
    // of the overlay also answer invokes from the main window.
    const { context } = createContext(ipcMain, window, { onlySameWindow: true })

    // The overlay renderer invokes these handlers at startup, so they must exist before the page loads.
    await setupBaseWindowElectronInvokes({ context, window, serverChannel: params.serverChannel, i18n: params.i18n })
    await load(window, withHashRoute(baseUrl(resolve(getElectronMainDirname(), '..', 'renderer'), 'dock-overlay.html'), '/dock-overlay', {
      query: { 'synced-leader': 'false' },
    }))
  }
  catch (error) {
    window.destroy()
    throw error
  }

  return window
}

/**
 * Sets up Dock Mode for the app.
 *
 * The overlay window is created on the first dock start and destroyed when docking stops.
 * Dock Mode does not depend on the main window. A normal close only hides the main window
 * (see `../main`), so a dock session continues after it. The app quit ends the session and
 * destroys the overlay window.
 */
export function setupDockOverlayWindowManager(params: { serverChannel: ServerChannel, i18n: I18n }): WindowDock {
  const windowDock = setupWindowDock({
    createOverlayWindow: () => createDockOverlayWindow(params),
  })

  onAppBeforeQuit(() => windowDock.dispose())

  return windowDock
}
