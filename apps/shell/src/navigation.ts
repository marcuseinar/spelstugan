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
 * How much of the table chat is showing, over the board.
 *
 * The board keeps the screen; chat rises over it. `peek` shows the last line
 * and the composer, which is enough to follow along without losing the game.
 */
export type SheetHeight = 'peek' | 'half' | 'full';

const LADDER: readonly SheetHeight[] = ['peek', 'half', 'full'];

function step(height: SheetHeight, by: number): SheetHeight {
  const index = LADDER.indexOf(height);
  const next = Math.min(LADDER.length - 1, Math.max(0, index + by));
  return LADDER[next] as SheetHeight;
}

export function expanded(height: SheetHeight): SheetHeight {
  return step(height, 1);
}

export function collapsed(height: SheetHeight): SheetHeight {
  return step(height, -1);
}

/** Tapping the handle opens the sheet, or closes it once fully open. */
export function afterTappingHandle(height: SheetHeight): SheetHeight {
  return height === 'full' ? 'peek' : expanded(height);
}

/** Below this, a drag is a tap: fingers move a little even when standing still. */
export const DRAG_THRESHOLD_PX = 36;

/**
 * Where a drag leaves the sheet.
 *
 * Dragging up is negative in screen coordinates, which is the opposite of
 * "more chat", so the sign is flipped here once rather than at each call site.
 */
export function afterDragging(height: SheetHeight, deltaY: number): SheetHeight {
  if (Math.abs(deltaY) < DRAG_THRESHOLD_PX) {
    return height;
  }
  return deltaY < 0 ? expanded(height) : collapsed(height);
}
