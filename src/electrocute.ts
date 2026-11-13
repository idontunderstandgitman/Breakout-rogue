// Part of the Breakout 71 rogue mode fork, a modified version of Breakout 71 by Renan LE CARO.
// Added in 2026. Licensed under the GNU AGPL v3, see the LICENSE file.
// Electrocute : synergy of multiball + ball_attract_ball.
// When two balls hit bricks at about the same time and those bricks are
// connected, a current runs between them and damages the bricks on the
// shortest path.

/** Two hits count as simultaneous when they are this close in time */
export const ELECTROCUTE_WINDOW_MS = 300;

/** Longest path, in bricks and endpoints included : 5, 7, 9 for levels 1 to 3 */
export function electrocuteMaxBricks(level: number) {
  return level > 0 ? 3 + 2 * level : 0;
}

/**
 * Shortest 4-neighbour path from `from` to `to` going through bricks.
 * The endpoints are always walkable, since the ball may just have broken them.
 * Returns the cell indexes from `from` to `to`, or null when there is none
 * within `maxBricks` cells.
 */
export function shortestBrickPath(
  bricks: string[],
  gridSize: number,
  from: number,
  to: number,
  maxBricks: number,
): number[] | null {
  if (from < 0 || to < 0 || maxBricks < 1) return null;
  if (from === to) return [from];
  const prev = new Map<number, number>([[from, -1]]);
  const depth = new Map<number, number>([[from, 1]]);
  const queue = [from];
  for (let head = 0; head < queue.length; head++) {
    const cur = queue[head];
    const d = depth.get(cur)!;
    if (d >= maxBricks) continue;
    const col = cur % gridSize;
    const neighbours = [
      col > 0 ? cur - 1 : -1,
      col < gridSize - 1 ? cur + 1 : -1,
      cur - gridSize,
      cur + gridSize,
    ];
    for (const n of neighbours) {
      if (n < 0 || n >= gridSize * gridSize || prev.has(n)) continue;
      if (n !== to && !bricks[n]) continue;
      prev.set(n, cur);
      depth.set(n, d + 1);
      if (n === to) {
        const path = [to];
        let p = cur;
        while (p !== -1) {
          path.push(p);
          p = prev.get(p)!;
        }
        return path.reverse();
      }
      queue.push(n);
    }
  }
  return null;
}

type Hit = { index: number; time: number };
const lastHits = new WeakMap<object, Hit>();

/**
 * Remember that `ball` hit `index` now, and look for another ball that hit
 * a brick within the time window. Returns the pair of cells to link, or null.
 */
export function registerBallHit(
  ball: object,
  otherBalls: object[],
  index: number,
  time: number,
): { a: number; b: number } | null {
  lastHits.set(ball, { index, time });
  for (const other of otherBalls) {
    if (other === ball) continue;
    const h = lastHits.get(other);
    if (h && Math.abs(time - h.time) <= ELECTROCUTE_WINDOW_MS) {
      // Used up : the same pair of hits must not fire twice
      lastHits.delete(other);
      lastHits.delete(ball);
      return { a: index, b: h.index };
    }
  }
  return null;
}
