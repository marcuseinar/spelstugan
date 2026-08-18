/**
 * Navigation state for small screens.
 *
 * On a wide screen the rail, the channel list and the channel are all visible
 * at once, so none of this applies. On a phone only one of them fits, so the
 * shell becomes a stack: the channel list pushes to a channel, and a back
 * control returns. Which of the two is showing is the only extra state that
 * needs keeping, and it is kept here rather than in the rendering so it can be
 * reasoned about and tested.
 *
 * Whether a screen counts as small is a CSS question, not this module's — the
 * layout answers it with media queries, and this state is simply ignored when
 * everything fits.
 */

/** Which pane a small screen is showing. Servers stay reachable throughout. */
export type MobileScreen = 'channels' | 'channel';

/** Choosing a server shows what is inside it. */
export function afterPickingServer(): MobileScreen {
  return 'channels';
}

/** Choosing a channel opens it. */
export function afterPickingChannel(): MobileScreen {
  return 'channel';
}

/** Going back from a channel returns to the list it came from. */
export function afterBack(): MobileScreen {
  return 'channels';
}

/** True when there is somewhere to go back to. */
export function canGoBack(screen: MobileScreen): boolean {
  return screen === 'channel';
}

/**
 * Whether the table chat is raised over the board.
 *
 * Two states rather than a ladder of them: a sheet you have to step through
 * is a sheet you have to think about. Closed still shows the newest line and
 * the composer, so following along costs nothing; open slides up over the
 * board and turns translucent, so the game stays visible behind the talk.
 */
export type SheetHeight = 'peek' | 'open';

export function toggled(height: SheetHeight): SheetHeight {
  return height === 'peek' ? 'open' : 'peek';
}

/** Below this, a gesture is a tap: fingers move a little even when standing still. */
export const DRAG_THRESHOLD_PX = 36;

/**
 * Where a pointer gesture leaves the sheet.
 *
 * A tap is a gesture that went nowhere, so both arrive here and the distance
 * travelled decides which one it was. Screen coordinates grow downwards, so
 * dragging up is negative — the sign is flipped here once rather than at every
 * call site. A gesture always resolves to a state rather than a position,
 * which is what keeps the sheet from stopping somewhere nobody chose.
 *
 * A deltaY of exactly zero never reaches the sign test, so `<` and `<=` are
 * indistinguishable there: mutating one into the other survives, equivalently.
 */
export function afterGesture(height: SheetHeight, deltaY: number): SheetHeight {
  if (Math.abs(deltaY) < DRAG_THRESHOLD_PX) {
    return toggled(height);
  }
  return deltaY < 0 ? 'open' : 'peek';
}
