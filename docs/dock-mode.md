## AIRI Dock Mode

Dock Mode keeps an AIRI overlay window on a target window that the user selects. The overlay is a transparent, click-through window that AIRI owns. Dock Mode does not reparent the windows of other apps, and it uses no private APIs.

The API reference is in [`packages/electron-window-dock/README.md`](../packages/electron-window-dock/README.md).

### Status

- Package: `packages/electron-window-dock`.
- App integration: `apps/stage-tamagotchi/src/main/windows/dock-overlay/`.
- UI: the devtools page `/devtools/window-dock`, in Settings > System > Developer. There is no user setting yet.
- Windows: a native window tracker. This version is not verified on Windows.
- macOS: the Electron-only tracker. It sees only the windows of AIRI, so Dock Mode can dock only to an AIRI window.
- Linux: no tracker. The target list is empty.

### Architecture

- `src/index.ts`: the Eventa contracts (`windowDock`), the shared types, and `defaultDockConfig`.
- `src/main/controller.ts`: `DockController`. It owns the session, the overlay window, the poll loop, and the config.
- `src/main/native/`: one window tracker for each platform. `native/index.ts` selects the tracker.
- `src/main/index.ts`: `setupWindowDock`. It creates the controller and registers the invoke handlers.

The app gives `createOverlayWindow` to `setupWindowDock`. This function does these steps:

1. It creates a hidden, transparent, not focusable window. The window has `skipTaskbar` and shows on all workspaces. On macOS, its type is `panel`, the same as the main window.
2. It creates an Eventa context with `onlySameWindow: true`, so the base handlers of the overlay hear only the overlay.
3. It registers the base window handlers. Then it loads `dock-overlay.html#/dock-overlay` with `synced-leader=false`.

If a step fails, or Dock Mode aborts the `signal` argument, the function destroys the window.

### Overlay lifecycle

- At app start, Dock Mode registers only the invoke handlers. No overlay window exists, and the Win32 tracker has not loaded its binding.
- The first `start` of a session creates and loads the overlay window. The window stays hidden until a tick shows it.
- `stop`, a lost target, and the app quit end the session. Each one stops the poll loop and destroys the overlay window.
- If the overlay creation fails, `start` rejects with its error. The session ends in `detached` with the reason `overlay-failed`.
- If the overlay creation takes longer than 30 s, Dock Mode aborts the signal of `createOverlayWindow`. Then `start` fails in the same way. Dock Mode destroys a window that arrives after the abort.
- If code outside Dock Mode closes or destroys the overlay window, the next tick ends the session in `detached` with the reason `overlay-destroyed`.
- A `stop` and a new `start` during the overlay creation share that creation. The new session uses the window.
- A normal close of the main window only hides that window. Dock Mode does not depend on the main window, so the session continues.
- The overlay renderer is a follower of the synchronized stores. It reads the stage model from `useSettingsStageModel`.
- It reads the theme from `useSettingsTheme`. This store reads localStorage and follows its changes from other windows.

### Visibility contract

Each tick reads the target. Then it applies the first rule that matches:

1. If the overlay window is destroyed, the session ends in `detached`.
2. If the tracker does not find the target, the session ends in `companion`.
3. If the target is hidden or minimized, the overlay hides. The state is `companion`, and polling continues.
4. If the target is fullscreen, the overlay hides. The state is `docking-attached-hidden`.
5. If a real window is above the target, the overlay hides. The state is `docking-attached-hidden`.
6. In all other cases, the overlay moves to the viewport rect of the target. It goes always on top and shows without focus.

Rule 5 does not apply when `showWhenNotFrontmost` is `true` or `hideWhenInactive` is `false`.

A real window above the target is not the overlay, not minimized, and on screen. It is at least 60 by 60 DIP, and its layer is 0 or not set.

A tracker can give a fullscreen flag. The Electron-only tracker gives it. The Win32 tracker gives no flag, so the controller compares the target bounds with the display bounds. A difference of up to 6 DIP on each value counts as a match.

When `clickThrough` is `true`, the overlay calls `setIgnoreMouseEvents(true, { forward: true })`. Mouse events go through the overlay to the windows below it.

### States

| State | Meaning |
| --- | --- |
| `detached` | No session. Dock Mode never started, a caller stopped it, or the overlay window failed or was destroyed. |
| `companion` | The target is hidden or minimized, and the session continues. A lost target also ends the session in this state. |
| `docking-attached-visible` | The overlay is on the target. |
| `docking-attached-hidden` | The target is fullscreen or not frontmost. The overlay is hidden. |

### Polling

- The poll loop runs only during a session. Without a target, nothing polls.
- While the overlay is visible, the interval is `activeIntervalMs` (80 ms).
- After the overlay shows or the target moves, `burstTicks` (3) ticks use `burstIntervalMs` (40 ms).
- While the target is hidden, fullscreen, or not frontmost, the interval is `hiddenIntervalMs` (1000 ms).
- A generation number increases on each `start` and at the end of each session. A tick that waited for the tracker stops if the number changed.
- The main process validates each config update with Valibot. It rejects values outside the limits in the package README.

### Platform trackers

#### Windows

- The tracker uses `listWindows`, `getWindow`, `getWindowsAbove`, and `getForegroundWindow` of `@proj-airi/native-window-win32`.
- It converts each rect from physical pixels to DIP with `screen.screenToDipRect`.
- The z-order walk drops each window of this process. Thus with the binding, AIRI windows, for example the always-on-top main window, do not count as windows above the target. This is not verified on Windows.
- If the target is the foreground window, the tracker reports no windows above it. Then the target counts as frontmost, even when the walk reports other windows above it.
- At debug level, the tracker logs the owner PID, the title, and the extended style of each window that the walk reports above the target. It logs again only when the list changes. The app sets the global log level to `Log`, so these logs do not show by default.
- The first tracker call loads the binding. If the load fails, the tracker logs one warning and uses the Electron-only fallback until the app quits.
- If a call to the binding fails, the tracker logs a warning and uses the fallback for that call.
- The fallback does not drop AIRI windows. The focused AIRI window and the visible always-on-top AIRI windows count as windows above the target, and they can hide the overlay.

The binding is a native build. The `build` script of the binding skips the native build when `cargo --version` fails. Then the app has no binding, and Dock Mode uses the Electron-only fallback. For the build steps, the CI variable `AIRI_REQUIRE_NATIVE_WINDOW_WIN32`, and the packaging rules, see [`packages/native-window-win32/README.md`](../packages/native-window-win32/README.md).

#### macOS

- The tracker uses the Electron-only fallback. It lists `BrowserWindow.getAllWindows()`, that is, only the windows of AIRI.
- The windows above the target are the focused AIRI window and the visible always-on-top AIRI windows.
- If no AIRI window has focus, the fallback reports one window of display size above the target. Then the overlay hides when another app has focus.

A native macOS tracker is not implemented. The plan is Core Graphics polling (`CGWindowListCopyWindowInfo`) and optional Accessibility events for move and resize.

#### Linux

There is no tracker. The target list is empty, and Dock Mode cannot start a useful session.

### IPC API (Eventa)

| Contract | Request | Response |
| --- | --- | --- |
| `windowDock.listTargets` | None | `WindowTargetSummary[]` without the overlay window |
| `windowDock.start` | `{ targetId }` | `DockDebugState` |
| `windowDock.stop` | None | `DockDebugState` |
| `windowDock.getDebugState` | None | `DockDebugState` |
| `windowDock.setConfig` | `DockConfig`, any subset | `DockDebugState`, or an error for an invalid value |

The handlers use an Eventa context without a window. Any renderer can call them, and the reply goes to the caller.

### Devtools page

- Lists the targets, with an on-screen filter and an automatic refresh.
- Starts and stops Dock Mode, and shows the debug state: state, poll interval, reason, windows above, target, and last update.
- Sets the poll intervals, the padding, click-through, the viewport, and the visibility options.
- Uses the shared renderer Eventa context of `@proj-airi/electron-vueuse`.

### Testing

- `pnpm -F @proj-airi/electron-window-dock exec vitest run` runs the package tests.
- The controller tests use a fake tracker, a fake overlay window, a mocked `electron.screen`, and fake timers.
- No automated test runs a real tracker or a real overlay window.
- No automated test covers the Win32 tracker, for example its foreground check. The tracker loads the binding only when `process.platform` is `win32`.
- No automated test covers the overlay window factory in `apps/stage-tamagotchi/src/main/windows/dock-overlay/`.

### Known limits

- The main window, the settings window, and the onboarding window create their Eventa contexts without `onlySameWindow`. Thus their base window handlers also run for invokes from other windows, for example the overlay.
- These contexts are in upstream code that Dock Mode does not change: `windows/main/index.ts`, `windows/settings/rpc/index.electron.ts`, and `windows/onboarding/index.ts` in `apps/stage-tamagotchi/src/main`.
- A macOS run of commit 5edfb6242 measured three handler runs for one invoke from the devtools page, and four for one invoke from the overlay. The handlers of a closed onboarding window were in this count. Each invoke returned the correct result.

### Not verified on Windows

Nobody ran this version on Windows. These parts are not verified on Windows:

- The z-order walk filters the windows of this process. An older version subtracted one window above the target. The cause of that window is not verified on Windows.
- A foreground target counts as frontmost. This check replaces the subtraction. Its effect on the extra window is not verified on Windows.
- The target list drops windows of this process that have the overlay title.
- The fullscreen check accepts a difference of 6 DIP.
- `screen.screenToDipRect` converts the rects of the binding to DIP.
- Click-through on the overlay window.

### Open items

- A native macOS tracker with Core Graphics, and optional Accessibility events.
- A user setting for Dock Mode outside the devtools page.
- Automatic reattach after a lost target, and a saved last target.
- Auto-hide when the cursor enters the overlay. This needs a global cursor hit test.
- `onlySameWindow` for the Eventa contexts of the main, settings, and onboarding windows. See [Known limits](#known-limits).

### References

- electron-overlay-window: <https://github.com/SnosMe/electron-overlay-window>
- electron-overlay-window macOS support PR: <https://github.com/SnosMe/electron-overlay-window/pull/17>
- electron-overlay-window macOS fullscreen issue: <https://github.com/SnosMe/electron-overlay-window/issues/37>
- awakened-poe-trade macOS overlay PR: <https://github.com/SnosMe/awakened-poe-trade/pull/403>
- Electron alwaysOnTop and macOS fullscreen (wontfix): <https://github.com/electron/electron/issues/10078>
- Core Graphics window APIs: `CGWindowListCopyWindowInfo`, `optionOnScreenAboveWindow`, `optionOnScreenOnly`, `excludeDesktopElements`, and the keys `kCGWindowBounds`, `kCGWindowLayer`, `kCGWindowIsOnscreen`, `kCGWindowNumber`
- Accessibility: `kAXMinimizedAttribute`, `kAXWindowMovedNotification`, `kAXWindowResizedNotification`
- Apple forums, fullscreen limits: <https://developer.apple.com/forums/thread/792917>
- yabai, AX event rate: <https://github.com/koekeishiya/yabai/issues/279>
