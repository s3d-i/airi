# @proj-airi/native-window-win32

Node-API bindings (built with [`napi-rs`](https://napi.rs/)) that expose the Win32 window metadata needed by AIRI’s Electron dock controller.

- Enumerates top-level windows in z-order.
- Reads rect, visibility/minimized flags, `GWL_EXSTYLE`, owner PID, title, and DWM cloaking state.
- Returns window ids in `win32:<hwndHex>` format to match existing overlay logic.

## Building

The native build runs only on Windows hosts. On other platforms, the `build` script skips the build and exits with success. Thus `pnpm install` works on macOS, Linux, and WSL2.

On Windows, `pnpm install` builds the package. The root `postinstall` runs `build` for each package through `build:packages`.

```bash
pnpm -F @proj-airi/native-window-win32 build         # Builds on Windows. Skips on other platforms.
pnpm -F @proj-airi/native-window-win32 build:native  # Always runs `napi build --platform --release`.
pnpm -F @proj-airi/native-window-win32 build:debug   # Always runs `napi build --platform`.
```

At runtime, consumers must load the bindings only when `process.platform === 'win32'`. On other platforms, they use Electron-only tracking.
