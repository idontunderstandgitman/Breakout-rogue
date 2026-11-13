import { GameState } from "./types";
import { getRowColIndex } from "./pure_functions";
import { brickCenterX, brickCenterY } from "./game_utils";

export const COINS_EXTRA_HIT_RADIUS = 1.2;

function getRow(gameState: GameState, y: number) {
  return Math.floor(y / gameState.brickWidth);
}
function getCol(gameState: GameState, x: number) {
  return Math.floor((x - gameState.offsetX) / gameState.brickWidth);
}

export function brickIndex(gameState: GameState, x: number, y: number) {
  const index = getRowColIndex(
    gameState,
    getRow(gameState, y),
    getCol(gameState, x),
  );
  if (isPointInBrick(gameState, index, x, y)) {
    return index;
  } else {
    return -1;
  }
}

export function hasBrick(
  gameState: GameState,
  index: number,
): number | undefined {
  if (gameState.bricks[index]) return index;
}

export function isPointInBrick(
  gameState: GameState,
  index: number,
  x: number,
  y: number,
) {
  const dx = x - brickCenterX(gameState, index);
  const dy = y - brickCenterY(gameState, index);
  if (gameState.perks.round_bricks && index !== -1) {
    const radius = gameState.brickWidth / 2.8;
    return dx * dx + dy * dy > radius * radius;
  } else {
    return (
      Math.abs(dx) < gameState.brickWidth / 2 &&
      Math.abs(dy) < gameState.brickWidth / 2
    );
  }
}

export function isPointInCircle(
  circleCenterX: number,
  circleCenterY: number,
  radius: number,
  pointX: number,
  pointY: number,
) {
  const dx = pointX - circleCenterX;
  const dy = pointY - circleCenterY;
  return dx * dx + dy * dy < radius * radius;
}

export function hitsSomething(
  gameState: GameState,
  x: number,
  y: number,
  radius: number,
) {
  // Find the index of the furthest brick intersecting with the circle
  const minRow = getRow(gameState, y - radius);
  const maxRow = getRow(gameState, y + radius);
  const minCol = getCol(gameState, x - radius);
  const maxCol = getCol(gameState, x + radius);

  // It would be best to start with the furthest cells, but really, this mostly
  // runs when the ball is in empty air and the order doesn't matter
  let highestDistance2 = -Infinity,
    bestIndex = undefined;
  for (let col = minCol; col <= maxCol; col++) {
    for (let row = minRow; row <= maxRow; row++) {
      const index = getRowColIndex(gameState, row, col);
      // Bedrock is solid too, even though it's not a brick
      if (
        index === -1 ||
        (!gameState.bricks[index] && !gameState.bedrock?.[index])
      ) {
        continue;
      }

      const brickX = brickCenterX(gameState, index);
      const brickY = brickCenterY(gameState, index);
      const dx = brickX - x;
      const dy = brickY - y;
      const dist2 = dx * dx + dy * dy;
      const delta = gameState.brickWidth / 2;

      let hit;
      if (gameState.perks.round_bricks) {
        const dMax = gameState.brickWidth / 2.8 + radius;
        hit = dist2 < dMax * dMax;
      } else {
        hit =
          // Circle center inside brick
          isPointInBrick(gameState, index, x, y) ||
          // Brick corner inside circle
          isPointInCircle(x, y, radius, brickX - delta, brickY - delta) ||
          isPointInCircle(x, y, radius, brickX + delta, brickY - delta) ||
          isPointInCircle(x, y, radius, brickX + delta, brickY + delta) ||
          isPointInCircle(x, y, radius, brickX - delta, brickY + delta) ||
          // borders overlapping
          (y > brickY - delta &&
            y < brickY + delta &&
            Math.abs(dx) < radius + delta) ||
          (x > brickX - delta &&
            x < brickX + delta &&
            Math.abs(dy) < radius + delta);
      }

      if (hit && dist2 > highestDistance2) {
        // we have a hit
        bestIndex = index;
        highestDistance2 = dist2;
      }
    }
  }
  return bestIndex;
}
