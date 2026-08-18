import { describe, expect, it } from 'vitest';
import { BASE, HOME } from '../board.js';
import { position } from '../testing.js';
import { tokenCell } from './geometry.js';
import { planTokenPlacements } from './placement.js';

function distanceFromCentre(offset: { x: number; y: number }): number {
  return Math.hypot(offset.x, offset.y);
}

describe('planTokenPlacements', () => {
  it('places every token of every seat', () => {
    const placements = planTokenPlacements(position({ tokens: [[5], [10], [2]] }));

    expect(placements).toHaveLength(12);
  });

  it('keeps each token’s identity with its position', () => {
    const placements = planTokenPlacements(position({ tokens: [[5], [10]] }));
    const first = placements[0];

    expect(first?.seat).toBe(0);
    expect(first?.tokenIndex).toBe(0);
  });

  it('puts a token on the square the board geometry says it occupies', () => {
    const placements = planTokenPlacements(position({ tokens: [[5], [10]] }));

    expect(placements[0]?.cell).toEqual(tokenCell(0, 5, 0));
  });

  it('leaves a token alone in its square exactly centred', () => {
    // Progress 5 is on the track, where nothing else stands.
    const placements = planTokenPlacements(position({ tokens: [[5, HOME, HOME, HOME], [30]] }));
    const lone = placements.find((placement) => placement.tokenIndex === 0);

    expect(lone?.offset).toEqual({ x: 0, y: 0 });
  });

  it('spreads tokens that share a square', () => {
    // All four of seat 0's tokens are home, so all four sit at the centre.
    const placements = planTokenPlacements(position({ tokens: [[HOME, HOME, HOME, HOME], [30]] }));
    const atCentre = placements.filter((placement) => placement.seat === 0);
    const offsets = atCentre.map((placement) => `${placement.offset.x},${placement.offset.y}`);

    expect(new Set(offsets).size).toBe(4);
  });

  it('gives every token on a shared square the same distance from its centre', () => {
    const placements = planTokenPlacements(position({ tokens: [[HOME, HOME, HOME, HOME], [30]] }));
    const distances = placements
      .filter((placement) => placement.seat === 0)
      .map((placement) => distanceFromCentre(placement.offset).toFixed(6));

    expect(new Set(distances).size).toBe(1);
  });

  it('spreads wider once a square is crowded', () => {
    const fourWay = planTokenPlacements(position({ tokens: [[HOME, HOME, HOME, HOME], [30]] }));
    const eightWay = planTokenPlacements(
      position({
        tokens: [
          [HOME, HOME, HOME, HOME],
          [HOME, HOME, HOME, HOME],
        ],
      }),
    );

    const spreadOf = (placements: readonly { offset: { x: number; y: number } }[]) =>
      distanceFromCentre(placements[0]?.offset ?? { x: 0, y: 0 });

    expect(spreadOf(eightWay)).toBeGreaterThan(spreadOf(fourWay));
  });

  it('separates the four tokens waiting in a yard', () => {
    const placements = planTokenPlacements(position({ tokens: [[BASE, BASE, BASE, BASE], [30]] }));
    const yardCellKeys = placements
      .filter((placement) => placement.seat === 0)
      .map((placement) => `${placement.cell.column},${placement.cell.row}`);

    // Each has its own square, so no fanning out is needed.
    expect(new Set(yardCellKeys).size).toBe(4);
  });

  it('does not offset tokens that have their own yard square', () => {
    const placements = planTokenPlacements(position({ tokens: [[BASE, BASE, BASE, BASE], [30]] }));

    expect(
      placements
        .filter((placement) => placement.seat === 0)
        .every((placement) => placement.offset.x === 0 && placement.offset.y === 0),
    ).toBe(true);
  });

  it('spreads two different seats meeting on one track square', () => {
    // Seat 1 enters 13 steps along seat 0's path — the same square.
    const placements = planTokenPlacements(position({ tokens: [[13], [0]] }));
    const sharing = placements.filter(
      (placement) => placement.tokenIndex === 0 && placement.seat <= 1,
    );

    expect(sharing.every((placement) => distanceFromCentre(placement.offset) > 0)).toBe(true);
  });
});
