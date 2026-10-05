import type { Rectangle } from 'electron'

import { screen } from 'electron'

/**
 * Returns the bounds of the display that fully contains `bounds`.
 * Returns `undefined` when the window spans displays or is off screen. Then the controller uses the display that matches the window best.
 */
export function getDisplayBounds(bounds: Rectangle): Rectangle | undefined {
  const display = screen.getAllDisplays().find((display) => {
    const d = display.bounds
    return (
      bounds.x >= d.x
      && bounds.y >= d.y
      && bounds.x + bounds.width <= d.x + d.width
      && bounds.y + bounds.height <= d.y + d.height
    )
  })
  return display?.bounds
}
