import { Buffer } from 'node:buffer'

import { describe, expect, it } from 'vitest'

import { getOverlayWindowIds } from './window-ids'

describe('getOverlayWindowIds', () => {
  it('returns the Electron IDs of the window', () => {
    expect(getOverlayWindowIds({ electronId: 7, platform: 'darwin' })).toEqual(['electron:7', '7'])
  })

  it('adds the Win32 ID of the native handle on win32', () => {
    const hwnd = Buffer.alloc(8)
    hwnd.writeBigUInt64LE(0xABCn)

    expect(getOverlayWindowIds({ electronId: 7, nativeHandle: hwnd, platform: 'win32' })).toEqual(['electron:7', '7', 'win32:abc'])
  })

  it('ignores the native handle on other platforms', () => {
    const handle = Buffer.alloc(8)
    handle.writeBigUInt64LE(0xABCn)

    expect(getOverlayWindowIds({ electronId: 7, nativeHandle: handle, platform: 'darwin' })).toEqual(['electron:7', '7'])
  })
})
