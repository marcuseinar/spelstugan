/**
 * Where each token is drawn.
 *
 * Kept apart from the drawing itself so it can be tested as the pure function
 * it is. Which square a token belongs on, and how tokens sharing a square are
 * arranged, are decisions; the colour and radius they are drawn with are not.
 */

import type { LudoShared } from '../state.js';
import { type Cell, tokenCell } from './geometry.js';

export interface TokenPlacement {
  readonly seat: number;
  readonly tokenIndex: number;
  readonly cell: Cell;
  /** Offset from the centre of the square, in cell widths. */
  readonly offset: { readonly x: number; readonly y: number };
}

function cellKey(cell: Cell): string {
  return `${cell.column},${cell.row}`;
}

/**
 * Spreads tokens that share a square around a small circle.
 *
 * Several tokens legitimately sit on one square — four waiting in a yard, or
 * everyone's finished tokens at the centre — and drawing them concentrically
 * would hide how many are there. The ring grows once a square is crowded.
 */
function offsetWithin(index: number, total: number): { x: number; y: number } {
  if (total <= 1) {
    return { x: 0, y: 0 };
  }
  const angle = (index / total) * Math.PI * 2;
  const radius = total > 4 ? 0.3 : 0.2;
  return { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius };
}

/** Every token on the board, with where it should be drawn. */
export function planTokenPlacements(shared: LudoShared): readonly TokenPlacement[] {
  const cells = shared.seats.flatMap((seat, seatIndex) =>
    seat.tokens.map((progress, tokenIndex) => ({
      seat: seatIndex,
      tokenIndex,
      cell: tokenCell(seatIndex, progress, tokenIndex),
    })),
  );

  const totals = new Map<string, number>();
  for (const { cell } of cells) {
    totals.set(cellKey(cell), (totals.get(cellKey(cell)) ?? 0) + 1);
  }

  const placed = new Map<string, number>();
  return cells.map((entry) => {
    const key = cellKey(entry.cell);
    const index = placed.get(key) ?? 0;
    placed.set(key, index + 1);
    return { ...entry, offset: offsetWithin(index, totals.get(key) ?? 1) };
  });
}
