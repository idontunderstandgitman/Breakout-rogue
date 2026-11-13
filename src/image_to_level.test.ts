// Part of the Breakout 71 rogue mode fork, a modified version of Breakout 71 by Renan LE CARO.
// Added in 2026. Licensed under the GNU AGPL v3, see the LICENSE file.
import { imagePixelsToLevel } from "./image_to_level";
import { levelCodeToRawLevel } from "./level_code_to_raw_level";

function px(rows: number[][][], w: number, h: number) {
  const out: number[] = [];
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) out.push(...rows[y][x]);
  return out;
}
const T = [0, 0, 0, 0];
const YELLOW = [255, 211, 0, 255];
const BLUE = [98, 98, 234, 255];

describe("imagePixelsToLevel", () => {
  it("uses the size of the picture, transparent pixels are empty", () => {
    const r = imagePixelsToLevel(
      px(
        [
          [YELLOW, T, BLUE],
          [T, T, T],
          [BLUE, T, YELLOW],
        ],
        3,
        3,
      ),
      3,
      3,
    );
    expect(r).toEqual({
      size: 3,
      bricks:
        "y_b______b_y".replace("______", "___").slice(0, 3) + "___" + "b_y",
    });
  });
  it("pads a non square picture", () => {
    const r = imagePixelsToLevel(
      px(
        [
          [YELLOW, YELLOW, YELLOW],
          [YELLOW, YELLOW, YELLOW],
        ],
        3,
        2,
      ),
      3,
      2,
    );
    expect(r).toEqual({ size: 3, bricks: "yyyyyy___" });
  });
  it("rejects sizes outside 2..24", () => {
    expect(imagePixelsToLevel([], 1, 1)).toEqual({ error: "size" });
    expect(imagePixelsToLevel([], 25, 25)).toEqual({ error: "size" });
  });
  it("keeps at most 5 colors and produces a valid level code", () => {
    const colors = [
      [255, 211, 0],
      [98, 98, 234],
      [230, 112, 112],
      [89, 238, 163],
      [166, 100, 232],
      [242, 158, 74],
      [255, 255, 255],
    ];
    const rows = [
      colors.map((c) => [...c, 255]),
      colors.map((c) => [...c, 255]),
    ];
    const r = imagePixelsToLevel(px(rows, 7, 2), 7, 2) as {
      size: number;
      bricks: string;
    };
    expect(
      new Set(r.bricks.split("").filter((b) => b !== "_")).size,
    ).toBeLessThanOrEqual(5);
    const lvl = levelCodeToRawLevel(
      JSON.stringify({ ...r, name: "x", author: "y", credit: "" }),
    );
    expect(lvl && lvl.size).toBe(7);
  });
});
