// Part of the Breakout 71 rogue mode fork, a modified version of Breakout 71 by Renan LE CARO.
// Added in 2026. Licensed under the GNU AGPL v3, see the LICENSE file.
import {
  ROGUE_MAX_SIZE,
  ROGUE_START_SIZE,
  bedrockCountFor,
  colorCountForRound,
  generateBrickLetters,
  isLevelSolvable,
  mixSeed,
  mulberry32,
  placeBedrock,
  rogueMapSize,
  rogueShopOpensBeforeRound,
  rogueUpgradePicks,
  roundsBeforeWithSameSize,
  shopOffers,
  shopSelection,
  shopPool,
  pickOffers,
  isBossRound,
  bossTimeLimitMs,
  curseOffer,
  activeCurseIds,
  rerollPrice,
  ROGUE_EXCLUDED_PERKS,
  ROGUE_CURSE_IDS,
  shopUnitPrice,
} from "./rogue_generator";
import palette from "./data/palette.json";

describe("map size progression", () => {
  it("starts at the base size and grows on every third map", () => {
    const sizes = Array.from({ length: 9 }, (_, round) => rogueMapSize(round));
    expect(sizes).toEqual([8, 8, 9, 9, 9, 10, 10, 10, 11]);
    for (let round = 0; round < 60; round++) {
      const grows = rogueMapSize(round) > rogueMapSize(round - 1);
      // maps number 3, 6, 9... (1 based) are the larger ones
      expect(grows).toBe((round + 1) % 3 === 0 && round > 0);
    }
  });

  it("never exceeds the cap and keeps going past the largest hand made size", () => {
    expect(rogueMapSize(10000)).toBe(ROGUE_MAX_SIZE);
    expect(rogueMapSize(0)).toBe(ROGUE_START_SIZE);
    expect(ROGUE_MAX_SIZE).toBeGreaterThan(24);
  });

  it("counts earlier rounds with the same size", () => {
    expect(roundsBeforeWithSameSize(0)).toBe(0);
    expect(roundsBeforeWithSameSize(1)).toBe(1);
    expect(roundsBeforeWithSameSize(2)).toBe(0);
    expect(roundsBeforeWithSameSize(4)).toBe(2);
    expect(roundsBeforeWithSameSize(5)).toBe(0);
  });
});

describe("upgrade picks and shop", () => {
  it("gives fewer upgrades for more missed shots, never below one", () => {
    expect(rogueUpgradePicks(0)).toBe(3);
    expect(rogueUpgradePicks(1)).toBe(2);
    expect(rogueUpgradePicks(2)).toBe(2);
    expect(rogueUpgradePicks(3)).toBe(1);
    expect(rogueUpgradePicks(50)).toBe(1);
    let previous = Infinity;
    for (let misses = 0; misses < 20; misses++) {
      const picks = rogueUpgradePicks(misses);
      expect(picks).toBeLessThanOrEqual(previous);
      expect(picks).toBeGreaterThanOrEqual(1);
      previous = picks;
    }
  });

  it("opens the shop every second round, never before the first", () => {
    const open = Array.from({ length: 9 }, (_, r) =>
      rogueShopOpensBeforeRound(r),
    );
    expect(open).toEqual([
      false,
      false,
      true,
      false,
      true,
      false,
      true,
      false,
      true,
    ]);
  });

  it("prices combo by map size and makes bigger tiers cost more", () => {
    expect(shopUnitPrice(2)).toBe(4);
    expect(shopUnitPrice(60)).toBe(30);
    const offers = shopOffers(60);
    expect(offers.map((o) => o.combo)).toEqual([5, 15, 40]);
    expect(offers.map((o) => o.price)).toEqual([150, 450, 1200]);
  });
});

describe("generated maps", () => {
  it("only uses valid palette letters, keeps the bottom free and is not empty", () => {
    for (let round = 0; round < 40; round++) {
      const size = rogueMapSize(round);
      const letters = generateBrickLetters(
        size,
        round,
        mulberry32(mixSeed(round, 7)),
      );
      expect(letters).toHaveLength(size * size);
      letters.forEach((l) => expect(l in palette).toBe(true));
      expect(letters.some((l) => l !== "_")).toBe(true);
      const bottomStart = Math.floor(size * 0.6) * size;
      expect(letters.slice(bottomStart).every((l) => l === "_")).toBe(true);
      const colors = new Set(letters.filter((l) => l !== "_" && l !== "B"));
      expect(colors.size).toBeLessThanOrEqual(colorCountForRound(round));
    }
  });

  it("is reproducible for the same seed and different for another one", () => {
    const a = generateBrickLetters(12, 5, mulberry32(42)).join("");
    const b = generateBrickLetters(12, 5, mulberry32(42)).join("");
    const c = generateBrickLetters(12, 5, mulberry32(43)).join("");
    expect(a).toBe(b);
    expect(a).not.toBe(c);
  });
});

describe("bedrock", () => {
  it("only appears from the third map and grows with the round", () => {
    expect(bedrockCountFor(0, 8)).toBe(0);
    expect(bedrockCountFor(1, 8)).toBe(0);
    expect(bedrockCountFor(2, 9)).toBeGreaterThan(0);
    expect(bedrockCountFor(20, 12)).toBeGreaterThan(bedrockCountFor(3, 12));
    // never fills the map
    expect(bedrockCountFor(500, 10)).toBeLessThanOrEqual(12);
  });

  it("detects a brick sealed in by bedrock", () => {
    const size = 6;
    const occupied = new Array(size * size).fill(false);
    const bedrock = new Array(size * size).fill(false);
    occupied[2 * size + 2] = true;
    expect(isLevelSolvable(occupied, bedrock, size)).toBe(true);
    // wall all around it
    [
      [1, 2],
      [3, 2],
      [2, 1],
      [2, 3],
    ].forEach(([x, y]) => (bedrock[y * size + x] = true));
    expect(isLevelSolvable(occupied, bedrock, size)).toBe(false);
  });

  it("refuses one cell wide corridors, balls would not fit", () => {
    const size = 8;
    const occupied = new Array(size * size).fill(false);
    const bedrock = new Array(size * size).fill(false);
    // brick at the top, bedrock shelf across row 4 with a single cell gap at x=3
    occupied[1 * size + 3] = true;
    for (let x = 0; x < size; x++) if (x !== 3) bedrock[4 * size + x] = true;
    expect(isLevelSolvable(occupied, bedrock, size)).toBe(false);
    // widen the gap to two cells
    bedrock[4 * size + 4] = false;
    expect(isLevelSolvable(occupied, bedrock, size)).toBe(true);
  });

  it("always leaves every brick reachable and the bottom 40% free, over many maps", () => {
    let withBedrock = 0;
    for (let round = 2; round < 60; round++) {
      for (let attempt = 0; attempt < 6; attempt++) {
        const size = rogueMapSize(round);
        const rng = mulberry32(mixSeed(round, attempt, 99));
        const letters = generateBrickLetters(size, round, rng);
        const bricks = letters.map((l) => (l === "_" ? "" : l));
        const replace = attempt % 2 === 0;
        const { bedrock, clearedBricks } = placeBedrock(
          bricks,
          size,
          bedrockCountFor(round, size),
          rng,
          replace,
        );
        const bedrockCount = bedrock.filter(Boolean).length;
        expect(bedrockCount).toBeLessThanOrEqual(bedrockCountFor(round, size));
        if (bedrockCount) withBedrock++;

        // bottom 40% untouched
        const bottomStart = Math.floor(size * 0.6) * size;
        expect(bedrock.slice(bottomStart).some(Boolean)).toBe(false);
        // bricks are only replaced when allowed, and never both brick and bedrock
        if (!replace) expect(clearedBricks).toHaveLength(0);
        clearedBricks.forEach((i) => expect(bedrock[i]).toBe(true));
        bedrock.forEach((b, i) => {
          if (b && !clearedBricks.includes(i)) expect(bricks[i]).toBe("");
        });

        const occupied = bricks.map(
          (b, i) => !!b && !clearedBricks.includes(i),
        );
        expect(isLevelSolvable(occupied, bedrock, size)).toBe(true);
      }
    }
    // the placement is not silently doing nothing
    expect(withBedrock).toBeGreaterThan(200);
  });

  it("never puts bedrock in empty space far from the bricks of a hand made level", () => {
    const size = 10;
    const bricks = new Array(size * size).fill("");
    for (let x = 2; x < 8; x++) bricks[1 * size + x] = "#FFD300";
    const { bedrock } = placeBedrock(bricks, size, 6, mulberry32(5), false);
    bedrock.forEach((b, i) => {
      if (!b) return;
      const x = i % size,
        y = Math.floor(i / size);
      const touchesBrick = [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ].some(([dx, dy]) => bricks[(y + dy) * size + (x + dx)]);
      expect(touchesBrick).toBe(true);
    });
  });
});

describe("shop selection", () => {
  it("shows 3 power-ups by default and 1 more per bonus option, capped by the pool", () => {
    const pool = shopPool(60);
    expect(pool.length).toBe(8);
    for (let round = 2; round < 30; round += 2) {
      expect(shopSelection(60, 1234, round, 0)).toHaveLength(3);
      expect(shopSelection(60, 1234, round, 1)).toHaveLength(4);
      expect(shopSelection(60, 1234, round, 9)).toHaveLength(8);
    }
  });

  it("is reproducible and has no duplicates", () => {
    const a = shopSelection(60, 99, 4, 0).map((i) => i.id);
    const b = shopSelection(60, 99, 4, 0).map((i) => i.id);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(a.length);
  });

  it("varies between rounds and offers every power-up sometime", () => {
    const seen = new Set<string>();
    for (let round = 2; round < 300; round += 2)
      shopSelection(60, 5, round, 0).forEach((i) => seen.add(i.id));
    expect(seen.size).toBe(8);
  });
});

describe("pickOffers", () => {
  const list = ["a", "b", "c", "d", "e", "f"].map((id) => ({ id }));
  const owned = (u: { id: string }) => ["d", "e", "f"].includes(u.id);
  it("keeps the order without the bias", () => {
    expect(pickOffers(list, 4, owned, false).map((u) => u.id)).toEqual([
      "a",
      "b",
      "c",
      "d",
    ]);
  });
  it("gives half of the slots to owned upgrades", () => {
    const ids = pickOffers(list, 4, owned, true).map((u) => u.id);
    expect(ids).toHaveLength(4);
    expect(ids.filter((i) => owned({ id: i }))).toHaveLength(2);
    expect(new Set(ids).size).toBe(4);
  });
  it("fills with others when not enough are owned", () => {
    const ids = pickOffers(list, 6, (u) => u.id === "f", true).map((u) => u.id);
    expect(ids).toHaveLength(6);
    expect(ids).toContain("f");
  });
});

describe("boss rounds", () => {
  it("come every 10th round, never the first, and follow the normal size schedule", () => {
    const bosses = [];
    for (let r = 0; r < 40; r++) if (isBossRound(r)) bosses.push(r + 1);
    expect(bosses).toEqual([10, 20, 30, 40]);
    expect(isBossRound(0)).toBe(false);
    // size does not depend on being a boss round
    expect(rogueMapSize(9)).toBe(rogueMapSize(9));
  });
  it("never exceed size / 2 bedrock, on any round", () => {
    for (let round = 0; round < 200; round++)
      for (let size = 5; size <= 24; size++)
        expect(bedrockCountFor(round, size)).toBeLessThanOrEqual(size / 2);
  });
  it("have more bedrock than a normal round of the same size", () => {
    expect(bedrockCountFor(9, 12)).toBeGreaterThan(bedrockCountFor(8, 12));
  });
  it("give more time for more bricks", () => {
    expect(bossTimeLimitMs(60)).toBeGreaterThan(bossTimeLimitMs(30));
  });
});

describe("curses", () => {
  it("never offers an active curse and nothing at the limit of 2", () => {
    for (let r = 2; r < 40; r += 2) {
      const id = curseOffer(7, r, { wrong_angle: 2, slow_paddle: 0, retro: 0 });
      expect(id === "slow_paddle" || id === "retro").toBe(true);
      expect(
        curseOffer(7, r, { wrong_angle: 2, slow_paddle: 1, retro: 0 }),
      ).toBeUndefined();
    }
  });
  it("lists active curses", () => {
    expect(
      activeCurseIds({ wrong_angle: 0, slow_paddle: 3, retro: 1 }),
    ).toEqual(["slow_paddle", "retro"]);
    expect(ROGUE_CURSE_IDS).toHaveLength(3);
  });
});

describe("reroll and extra life", () => {
  it("doubles the reroll price each time", () => {
    expect(rerollPrice(60, 1)).toBe(2 * rerollPrice(60, 0));
    expect(rerollPrice(60, 3)).toBe(8 * rerollPrice(60, 0));
  });
  it("different rerolls give different shops, sold out items are removed", () => {
    const shops = new Set<string>();
    for (let r = 0; r < 12; r++)
      shops.add(
        shopSelection(60, 4, 2, 0, [], r)
          .map((i) => i.id)
          .join(),
      );
    expect(shops.size).toBeGreaterThan(3);
    for (let r = 0; r < 12; r++)
      expect(
        shopSelection(60, 4, 2, 9, ["extra_life"], r).some(
          (i) => i.id === "extra_life",
        ),
      ).toBe(false);
  });
  it("extra life is only sold in the shop", () => {
    expect(ROGUE_EXCLUDED_PERKS).toContain("extra_life");
    expect(shopPool(60).some((i) => i.id === "extra_life")).toBe(true);
  });
});
