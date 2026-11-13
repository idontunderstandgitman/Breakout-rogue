// Part of the Breakout 71 rogue mode fork, a modified version of Breakout 71 by Renan LE CARO.
// Added in 2026. Licensed under the GNU AGPL v3, see the LICENSE file.
import _palette from "./data/palette.json";
import { MAX_LEVEL_SIZE, MIN_LEVEL_SIZE } from "./pure_functions";

/** Same limit as level codes : colors other than empty and bomb */
export const MAX_IMPORT_COLORS = 5;
const ALPHA_LIMIT = 128;

type Rgb = [number, number, number];

const palette = _palette as Record<string, string>;

// Colors a picture pixel can become. "_" is empty and "B" is a bomb, they are never guessed.
const COLOR_LETTERS = Object.keys(palette).filter(
  (k) => k !== "_" && k !== "B" && /^#[0-9a-f]{6}$/i.test(palette[k]),
);

function hexToRgb(hex: string): Rgb {
  return [
    parseInt(hex.slice(1, 3), 16),
    parseInt(hex.slice(3, 5), 16),
    parseInt(hex.slice(5, 7), 16),
  ];
}

function distance(a: Rgb, b: Rgb) {
  // Weighted so that green differences count more, as the eye does
  const dr = a[0] - b[0],
    dg = a[1] - b[1],
    db = a[2] - b[2];
  return 2 * dr * dr + 4 * dg * dg + 3 * db * db;
}

function nearestLetter(rgb: Rgb, letters: string[]) {
  let best = letters[0];
  let bestDistance = Infinity;
  for (const letter of letters) {
    const d = distance(rgb, hexToRgb(palette[letter]));
    if (d < bestDistance) {
      bestDistance = d;
      best = letter;
    }
  }
  return best;
}

/**
 * Turns RGBA pixels (one pixel = one brick) into a level.
 * Transparent pixels are empty. A picture that is not square is padded with empty bricks.
 * Colors are matched to the closest palette color, and only the MAX_IMPORT_COLORS most used
 * ones are kept, the others take the closest kept color.
 */
export function imagePixelsToLevel(
  pixels: ArrayLike<number>,
  width: number,
  height: number,
): { size: number; bricks: string } | { error: "size" } {
  const size = Math.max(width, height);
  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    size < MIN_LEVEL_SIZE ||
    size > MAX_LEVEL_SIZE
  ) {
    return { error: "size" };
  }

  const cache = new Map<number, string>();
  const letters: string[] = new Array(size * size).fill("_");
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      if (pixels[i + 3] < ALPHA_LIMIT) continue;
      const key = (pixels[i] << 16) | (pixels[i + 1] << 8) | pixels[i + 2];
      let letter = cache.get(key);
      if (!letter) {
        letter = nearestLetter(
          [pixels[i], pixels[i + 1], pixels[i + 2]],
          COLOR_LETTERS,
        );
        cache.set(key, letter);
      }
      letters[y * size + x] = letter;
    }
  }

  const counts = new Map<string, number>();
  letters.forEach((l) => l !== "_" && counts.set(l, (counts.get(l) || 0) + 1));
  if (counts.size > MAX_IMPORT_COLORS) {
    const kept = [...counts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, MAX_IMPORT_COLORS)
      .map(([l]) => l);
    for (let i = 0; i < letters.length; i++) {
      const l = letters[i];
      if (l !== "_" && !kept.includes(l)) {
        letters[i] = nearestLetter(hexToRgb(palette[l]), kept);
      }
    }
  }
  return { size, bricks: letters.join("") };
}

/** Reads an image file at its own resolution : one pixel is one brick */
export async function imageFileToLevel(file: File) {
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    img.src = url;
    await img.decode();
    const width = img.naturalWidth;
    const height = img.naturalHeight;
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    const ctx = canvas.getContext("2d", { willReadFrequently: true });
    if (!ctx) return { error: "size" as const };
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    const data = ctx.getImageData(0, 0, width, height).data;
    return { ...imagePixelsToLevel(data, width, height), width, height };
  } finally {
    URL.revokeObjectURL(url);
  }
}
