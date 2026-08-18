/**
 * Drawing the Ludo board as SVG.
 *
 * Every colour here comes from a CSS custom property, never a literal — user
 * themes are planned (decision 013), and a token that names a role rather than
 * a colour is what makes that a config change instead of a rewrite. The one
 * exception is seat colour, which carries game meaning: a theme that made two
 * players' pieces alike would break the game, so seats own their palette.
 */

import { SEATS, isSafeCell } from '../board.js';
import type { LudoShared } from '../state.js';
import {
  CENTRE,
  type Cell,
  GRID,
  homeColumnCells,
  seatStartIndex,
  trackCells,
  yardArea,
  yardCells,
} from './geometry.js';
import { planTokenPlacements } from './placement.js';

const SVG_NS = 'http://www.w3.org/2000/svg';
/** One board square, in user units. The viewBox scales it to any size. */
const CELL = 10;

export interface TokenTarget {
  readonly seat: number;
  readonly tokenIndex: number;
}

function element<K extends keyof SVGElementTagNameMap>(
  name: K,
  attributes: Record<string, string | number>,
): SVGElementTagNameMap[K] {
  const created = document.createElementNS(SVG_NS, name);
  for (const [key, value] of Object.entries(attributes)) {
    created.setAttribute(key, String(value));
  }
  return created;
}

function square(cell: Cell, fill: string, extra: Record<string, string | number> = {}) {
  return element('rect', {
    x: cell.column * CELL,
    y: cell.row * CELL,
    width: CELL,
    height: CELL,
    rx: 1.5,
    fill,
    ...extra,
  });
}

function seatColour(seat: number): string {
  return `var(--seat-${seat})`;
}

/** The four home triangles meeting at the centre. */
function centrePiece(): SVGGElement {
  const group = element('g', {});
  const middle = { x: (CENTRE.column + 0.5) * CELL, y: (CENTRE.row + 0.5) * CELL };
  const corners = [
    [CENTRE.column, CENTRE.row],
    [CENTRE.column + 1, CENTRE.row],
    [CENTRE.column + 1, CENTRE.row + 1],
    [CENTRE.column, CENTRE.row + 1],
  ] as const;

  // Seat 0's triangle points down-left; the rest follow the same rotation the
  // rest of the board uses, so the colours line up with each home column.
  const seatOfEdge = [1, 2, 3, 0];

  corners.forEach(([column, row], edge) => {
    const [nextColumn, nextRow] = corners[(edge + 1) % corners.length] as readonly [number, number];
    group.append(
      element('polygon', {
        points: `${column * CELL},${row * CELL} ${nextColumn * CELL},${nextRow * CELL} ${middle.x},${middle.y}`,
        fill: seatColour(seatOfEdge[edge] as number),
        opacity: 0.85,
      }),
    );
  });

  return group;
}

/** The static parts: yards, track, home columns, centre. Drawn once. */
function drawBoard(): SVGGElement {
  const group = element('g', {});

  group.append(
    element('rect', {
      x: 0,
      y: 0,
      width: GRID * CELL,
      height: GRID * CELL,
      fill: 'var(--board-bg)',
    }),
  );

  for (let seat = 0; seat < SEATS; seat += 1) {
    const { corner, size } = yardArea(seat);
    group.append(
      element('rect', {
        x: corner.column * CELL,
        y: corner.row * CELL,
        width: size * CELL,
        height: size * CELL,
        rx: 4,
        fill: seatColour(seat),
        opacity: 0.22,
      }),
    );

    for (const cell of yardCells(seat)) {
      group.append(
        element('circle', {
          cx: (cell.column + 0.5) * CELL,
          cy: (cell.row + 0.5) * CELL,
          r: CELL * 0.42,
          fill: 'var(--board-bg)',
          stroke: seatColour(seat),
          'stroke-width': 0.8,
          opacity: 0.9,
        }),
      );
    }
  }

  trackCells().forEach((cell, index) => {
    const owningSeat = Array.from({ length: SEATS }, (_, seat) => seat).find(
      (seat) => seatStartIndex(seat) === index,
    );
    const fill = owningSeat === undefined ? 'var(--track)' : seatColour(owningSeat);
    group.append(
      square(cell, fill, {
        stroke: 'var(--board-line)',
        'stroke-width': 0.4,
        ...(owningSeat === undefined ? {} : { opacity: 0.85 }),
      }),
    );

    if (owningSeat === undefined && isSafeCell(index)) {
      group.append(
        element('circle', {
          cx: (cell.column + 0.5) * CELL,
          cy: (cell.row + 0.5) * CELL,
          r: CELL * 0.22,
          fill: 'var(--board-line)',
        }),
      );
    }
  });

  for (let seat = 0; seat < SEATS; seat += 1) {
    for (const cell of homeColumnCells(seat)) {
      group.append(
        square(cell, seatColour(seat), {
          opacity: 0.7,
          stroke: 'var(--board-line)',
          'stroke-width': 0.4,
        }),
      );
    }
  }

  group.append(centrePiece());
  return group;
}

export interface BoardRenderOptions {
  /** Tokens the viewer may move right now. */
  readonly movable: readonly TokenTarget[];
  readonly onTokenPicked: (target: TokenTarget) => void;
}

/** The moving parts: every token, redrawn whenever state changes. */
function drawTokens(shared: LudoShared, options: BoardRenderOptions): SVGGElement {
  const group = element('g', {});

  for (const placement of planTokenPlacements(shared)) {
    const isMovable = options.movable.some(
      (target) => target.seat === placement.seat && target.tokenIndex === placement.tokenIndex,
    );

    const token = element('circle', {
      cx: (placement.cell.column + 0.5 + placement.offset.x) * CELL,
      cy: (placement.cell.row + 0.5 + placement.offset.y) * CELL,
      r: CELL * 0.34,
      fill: seatColour(placement.seat),
      stroke: 'var(--token-edge)',
      'stroke-width': 0.7,
      class: isMovable ? 'token token--movable' : 'token',
    });

    if (isMovable) {
      token.addEventListener('click', () =>
        options.onTokenPicked({ seat: placement.seat, tokenIndex: placement.tokenIndex }),
      );
    }

    group.append(token);
  }

  return group;
}

export interface BoardHandle {
  readonly svg: SVGSVGElement;
  render(shared: LudoShared, options: BoardRenderOptions): void;
}

/** Creates the board, with the static layer drawn once and tokens on top. */
export function createBoard(): BoardHandle {
  const svg = element('svg', {
    viewBox: `0 0 ${GRID * CELL} ${GRID * CELL}`,
    class: 'ludo-board',
    role: 'img',
    'aria-label': 'Ludo board',
  });

  svg.append(drawBoard());
  let tokenLayer = element('g', {});
  svg.append(tokenLayer);

  return {
    svg,
    render(shared, options) {
      const replacement = drawTokens(shared, options);
      tokenLayer.replaceWith(replacement);
      tokenLayer = replacement;
    },
  };
}
