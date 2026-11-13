import { Level } from "./types";
import { allLevelsAndIcons } from "./loadGameData";

let levelIconHTMLCanvas = document.createElement("canvas");

const levelIconHTMLCanvasCtx =
  process.env.NODE_ENV !== "test" &&
  (levelIconHTMLCanvas.getContext("2d", {
    antialias: false,
    alpha: true,
  }) as CanvasRenderingContext2D);

export function levelIconHTML(
  bricks: string[],
  levelSize: number,
  baseSize = 46,
) {
  // For these icons, let's just keep using the pixel ratio no matter what the setting say,
  // because they can't update and are not impacting performance much
  const size = baseSize * (window.devicePixelRatio || 1);
  const c = levelIconHTMLCanvas;
  const ctx = levelIconHTMLCanvasCtx;

  if (!ctx) return "";
  c.width = size;
  c.height = size;

  ctx.clearRect(0, 0, size, size);

  const pxSize = size / levelSize;
  for (let x = 0; x < levelSize; x++) {
    for (let y = 0; y < levelSize; y++) {
      const c = bricks[y * levelSize + x];
      if (c) {
        ctx.fillStyle = c;
        ctx.fillRect(
          Math.floor(pxSize * x),
          Math.floor(pxSize * y),
          Math.ceil(pxSize),
          Math.ceil(pxSize),
        );
      }
    }
  }

  return `<img alt="" width="${size / window.devicePixelRatio}" height="${size / window.devicePixelRatio}" src="${c.toDataURL()}"/>`;
}

let iconCache: Record<string, string> = {};
export function getIcon(levelName: Level["name"], size = 46) {
  const key = levelName + size;
  if (!iconCache[key]) {
    const level = allLevelsAndIcons.find((l) => l.name === levelName) as Level;
    iconCache[key] = levelIconHTML(level?.bricks, level?.size, size);
  }
  return iconCache[key];
}

export function getCheckboxIcon(checked: boolean, size = 46) {
  return getIcon(
    checked ? "icon:checkmark_checked" : "icon:checkmark_unchecked",
    size,
  );
}
