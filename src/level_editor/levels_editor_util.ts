import { RawLevel } from "../types";

export function resizeLevel(level: RawLevel, sizeDelta: number) {
  const { size, bricks } = level;
  const newSize = Math.max(1, size + sizeDelta);
  const newBricks = [];
  for (let x = 0; x < newSize; x++) {
    for (let y = 0; y < newSize; y++) {
      newBricks[y * newSize + x] = brickAt(level, x, y);
    }
  }
  return {
    size: newSize,
    bricks: newBricks.join(""),
  };
}

export function brickAt(level: RawLevel, x: number, y: number) {
  return (
    (x >= 0 &&
      x < level.size &&
      y >= 0 &&
      y < level.size &&
      level.bricks.split("")[y * level.size + x]) ||
    "_"
  );
}

export function moveLevel(level: RawLevel, dx: number, dy: number) {
  const { size } = level;
  const newBricks = new Array(size * size).fill("_");
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      newBricks[y * size + x] = brickAt(level, x - dx, y - dy);
    }
  }
  return {
    bricks: newBricks.join(""),
  };
}

export function setBrick(level: RawLevel, index: number, colorCode: string) {
  const { size } = level;
  const newBricks = [];
  for (let x = 0; x < size; x++) {
    for (let y = 0; y < size; y++) {
      const brickIndex = y * size + x;
      newBricks[brickIndex] =
        (brickIndex === index && colorCode) || brickAt(level, x, y);
    }
  }
  return {
    bricks: newBricks.join(""),
  };
}
