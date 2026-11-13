// Part of the Breakout 71 rogue mode fork, a modified version of Breakout 71 by Renan LE CARO.
// Added in 2026. Licensed under the GNU AGPL v3, see the LICENSE file.
// Pure helpers for rogue mode : map sizes, procedural maps, bedrock placement,
// upgrade picks and shop prices. No DOM or game imports in here so it stays easy to test
// and safe to import from anywhere.
import type { GameState, PerkId } from "./types";

export function isRogue(gameState: GameState) {
  return gameState.startParams.runType === "rogue";
}

/** Rogue test mode : unlimited money and upgrades, can skip levels, nothing is saved */
export function isRogueTest(gameState: GameState) {
  return isRogue(gameState) && !!gameState.startParams.testMode;
}

/** Wallet of a test run, it is topped up every round */
export const ROGUE_TEST_WALLET = 1_000_000_000;

// Runs that fill the lifetime score, can be resumed, and use the starting perk system
export function isProgressRun(gameState: GameState) {
  return ["normal", "rogue"].includes(gameState.startParams.runType);
}

// Those would break an endless run : fixed length and "no more upgrades"
// extra_life is sold in the shop only
export const ROGUE_EXCLUDED_PERKS: PerkId[] = [
  "extra_levels",
  "chill",
  "extra_life",
];

export function newRogueSeed() {
  return Math.floor(Math.random() * 2 ** 31);
}

// ---- Tuning knobs -------------------------------------------------------

// Size of the first maps of a rogue run
export const ROGUE_START_SIZE = 8;
// Hand made levels stop at this size, after that every map is generated
export const ROGUE_MAX_HANDMADE_SIZE = 24;
// Generated maps keep growing every third round up to this size, then only get harder
export const ROGUE_MAX_SIZE = 30;
// Bedrock shows up on the third map
export const ROGUE_BEDROCK_FROM_ROUND = 2;
// Base speed grows with the level number, this stops it from growing forever
export const ROGUE_SPEED_LEVEL_CAP = 24;
// The shop opens before every second round (3rd, 5th, 7th ...)
export const ROGUE_SHOP_EVERY = 2;
// "Start the round with X combo" tiers sold in the shop
export const ROGUE_SHOP_TIERS = [5, 15, 40];

// ---- Random numbers -----------------------------------------------------

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function () {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mixSeed(...numbers: number[]) {
  let h = 2166136261;
  for (const n of numbers) {
    h ^= n | 0;
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

function shuffled<T>(list: readonly T[], rng: () => number) {
  const copy = [...list];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

// ---- Progression --------------------------------------------------------

/** Size of the map for a 0 based round. Rounds 1 and 2 share a size, then every third round is larger. */
export function rogueMapSize(round: number) {
  return Math.min(
    ROGUE_MAX_SIZE,
    ROGUE_START_SIZE + Math.floor((round + 1) / 3),
  );
}

/** How many earlier rounds of this run used the same map size */
export function roundsBeforeWithSameSize(round: number) {
  const size = rogueMapSize(round);
  let count = 0;
  for (let j = 0; j < round; j++) if (rogueMapSize(j) === size) count++;
  return count;
}

/** Upgrades picked after a round, based only on how many shots missed every brick */
export function rogueUpgradePicks(misses: number) {
  if (misses <= 0) return 3;
  if (misses <= 2) return 2;
  return 1;
}

/**
 * Picks the upgrades to offer. With ownedBias, at least half of the slots (rounded up) go to
 * upgrades already owned, as far as there are enough of them. Input must be sorted by score.
 */
export function pickOffers<T extends { id: string }>(
  sorted: T[],
  count: number,
  owned: (u: T) => boolean,
  ownedBias: boolean,
): T[] {
  if (!ownedBias) return sorted.slice(0, count);
  const ownedOnes = sorted.filter(owned).slice(0, Math.ceil(count / 2));
  const taken = new Set(ownedOnes.map((u) => u.id));
  const others = sorted
    .filter((u) => !taken.has(u.id))
    .slice(0, count - ownedOnes.length);
  return [...ownedOnes, ...others];
}

export function rogueShopOpensBeforeRound(round: number) {
  return round > 0 && round % ROGUE_SHOP_EVERY === 0;
}

/** Price of +1 starting combo. A combo point is worth about one coin per brick broken. */
export function shopUnitPrice(bricksCount: number) {
  return Math.max(4, Math.round(bricksCount * 0.5));
}

export type ShopItem =
  | { id: string; kind: "combo"; combo: number; price: number }
  | { id: "bedrock_shield"; kind: "bedrock_shield"; price: number }
  | { id: "extra_choice"; kind: "extra_choice"; price: number }
  | { id: "remove_upgrade"; kind: "remove_upgrade"; price: number }
  | { id: "owned_bias"; kind: "owned_bias"; price: number }
  | { id: "extra_life"; kind: "extra_life"; price: number };

/** Price in units of shopUnitPrice for the non combo power-ups */
export const ROGUE_SHIELD_UNITS = 12;
export const ROGUE_SHIELD_ROUNDS = 2;
export const ROGUE_EXTRA_CHOICE_UNITS = 15;
export const ROGUE_REMOVE_UNITS = 10;
export const ROGUE_OWNED_BIAS_UNITS = 8;
/** Extra lives can not be restored : at most this many can be bought per run */
export const ROGUE_MAX_LIVES = 3;
export const ROGUE_LIFE_UNITS = 80;
/** Options shown in every shop, before any "+1 option" power-up */
export const ROGUE_SHOP_BASE_OPTIONS = 3;

/** Every power-up that can be on sale, in a fixed order */
export function shopPool(bricks: number): ShopItem[] {
  const unit = shopUnitPrice(bricks);
  return [
    ...ROGUE_SHOP_TIERS.map(
      (combo) =>
        ({
          id: "combo:" + combo,
          kind: "combo",
          combo,
          price: combo * unit,
        }) as ShopItem,
    ),
    {
      id: "bedrock_shield",
      kind: "bedrock_shield",
      price: ROGUE_SHIELD_UNITS * unit,
    },
    {
      id: "extra_choice",
      kind: "extra_choice",
      price: ROGUE_EXTRA_CHOICE_UNITS * unit,
    },
    {
      id: "remove_upgrade",
      kind: "remove_upgrade",
      price: ROGUE_REMOVE_UNITS * unit,
    },
    {
      id: "owned_bias",
      kind: "owned_bias",
      price: ROGUE_OWNED_BIAS_UNITS * unit,
    },
    {
      id: "extra_life",
      kind: "extra_life",
      price: ROGUE_LIFE_UNITS * unit,
    },
  ];
}

/** Kept for the combo only view of the shop */
export function shopOffers(bricks: number) {
  return shopPool(bricks)
    .filter(
      (i): i is Extract<ShopItem, { kind: "combo" }> => i.kind === "combo",
    )
    .map((i) => ({ combo: i.combo, price: i.price }));
}

/**
 * Power-ups on sale in one shop : ROGUE_SHOP_BASE_OPTIONS of the pool plus the bonus
 * options bought earlier. Seeded, so reopening a saved shop shows the same items.
 */
export function shopSelection(
  bricks: number,
  seed: number,
  round: number,
  bonusOptions: number,
  soldOut: string[] = [],
  reroll = 0,
): ShopItem[] {
  const pool = shopPool(bricks).filter((i) => !soldOut.includes(i.id));
  const rng = mulberry32(mixSeed(seed, round, 977 + reroll * 131));
  const shuffled = pool
    .map((item) => ({ item, k: rng() }))
    .sort((a, b) => a.k - b.k)
    .map((o) => o.item);
  const count = Math.min(pool.length, ROGUE_SHOP_BASE_OPTIONS + bonusOptions);
  const chosen = new Set(shuffled.slice(0, count).map((i) => i.id));
  // Show them in the fixed pool order, cheap combo first
  return pool.filter((i) => chosen.has(i.id));
}

// Letters of data/palette.json that are easy to tell apart
const COLOR_LETTERS = ["y", "b", "s", "c", "v", "O", "G", "p"];

export function colorCountForRound(round: number) {
  return Math.min(COLOR_LETTERS.length, 2 + Math.floor(round / 3));
}

/**
 * Returns size*size palette letters ("_" is empty, "B" is a bomb).
 * The bottom 40% is always empty so there's room to play.
 */
export function generateBrickLetters(
  size: number,
  round: number,
  rng: () => number,
) {
  const rows = Math.max(3, Math.floor(size * 0.6));
  const colors = shuffled(COLOR_LETTERS, rng).slice(
    0,
    colorCountForRound(round),
  );
  const density = Math.min(0.9, 0.55 + round * 0.02);
  const style = Math.floor(rng() * 4);
  const grid: string[] = new Array(size * size).fill("_");

  // Color layout : blocks of random size so colors form patches
  const patchW = 1 + Math.floor(rng() * 3);
  const patchH = 1 + Math.floor(rng() * 3);
  const colorOffset = Math.floor(rng() * colors.length);
  const colorAt = (x: number, y: number) => {
    if (rng() < 0.12) return colors[Math.floor(rng() * colors.length)];
    return colors[
      (Math.floor(x / patchW) + Math.floor(y / patchH) * 2 + colorOffset) %
        colors.length
    ];
  };

  const half = Math.ceil(size / 2);
  const mirrorMask: boolean[] = [];
  for (let y = 0; y < rows; y++)
    for (let x = 0; x < half; x++) mirrorMask[y * half + x] = rng() < density;

  const centerX = (size - 1) / 2;
  const centerY = (rows - 1) / 2;
  const stripePeriod = 2 + Math.floor(rng() * 3);

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < size; x++) {
      let on: boolean;
      switch (style) {
        case 0: // left/right mirrored noise
          on = mirrorMask[y * half + Math.min(x, size - 1 - x)];
          break;
        case 1: // horizontal bands with holes
          on = y % stripePeriod !== stripePeriod - 1 && rng() < density + 0.1;
          break;
        case 2: // diamond, hollowed out by density
          on =
            Math.abs(x - centerX) / (size / 2) +
              Math.abs(y - centerY) / (rows / 2) <=
              1.15 && rng() < density + 0.15;
          break;
        default: // diagonal stripes
          on = (x + y) % stripePeriod !== 0 && rng() < density + 0.1;
      }
      if (on) grid[y * size + x] = colorAt(x, y);
    }
  }

  // Never return an empty map
  if (!grid.some((c) => c !== "_")) {
    for (let x = 0; x < size; x++) grid[x] = colors[0];
  }

  // Bombs, a few more as the run goes on
  const bricks = grid.map((c, i) => (c !== "_" ? i : -1)).filter((i) => i >= 0);
  const bombs = Math.min(
    6,
    Math.floor(round / 4),
    Math.floor(bricks.length / 8),
  );
  shuffled(bricks, rng)
    .slice(0, bombs)
    .forEach((i) => (grid[i] = "B"));

  return grid;
}

// ---- Bedrock ------------------------------------------------------------

const isEmptyCell = (c: string | undefined) => !c || c === "_";

/** How many bedrock cells a map gets */
export function bedrockCountFor(round: number, size: number) {
  if (round < ROGUE_BEDROCK_FROM_ROUND) return 0;
  const boss = isBossRound(round);
  // A size x size grid never gets more than size / 2 bedrock. Boss rounds reach that,
  // normal rounds stop at half of it, which keeps the boss at twice the bedrock.
  const cap = Math.floor(boss ? size / 2 : size / 4);
  const base = Math.ceil(((round - 1) * size) / 20);
  return Math.min(cap, boss ? base * ROGUE_BOSS_BEDROCK_FACTOR : base);
}

// ---- Boss rounds ----------------------------------------------------------
// Same map size schedule as any other round : only more bedrock, a timer and a reward.
export const ROGUE_BOSS_EVERY = 10;
export const ROGUE_BOSS_BEDROCK_FACTOR = 2;
export const ROGUE_BOSS_BASE_MS = 30000;
export const ROGUE_BOSS_MS_PER_BRICK = 1500;
export const ROGUE_BOSS_REWARD_PICKS = 3;
export const ROGUE_BOSS_REWARD_CHOICES = 2;

/** 0 based round : the 10th, 20th ... round of the run */
export function isBossRound(round: number) {
  return round > 0 && (round + 1) % ROGUE_BOSS_EVERY === 0;
}

/** Boss bricks come back after this long : slower for bigger maps so that clearing stays possible */
export const ROGUE_BOSS_RESPAWN_MIN_MS = 10000;
export const ROGUE_BOSS_RESPAWN_MS_PER_BRICK = 250;
export function bossRespawnMs(bricks: number) {
  return Math.max(
    ROGUE_BOSS_RESPAWN_MIN_MS,
    ROGUE_BOSS_RESPAWN_MS_PER_BRICK * bricks,
  );
}

export function bossTimeLimitMs(bricks: number) {
  return ROGUE_BOSS_BASE_MS + ROGUE_BOSS_MS_PER_BRICK * bricks;
}

// ---- Curses ---------------------------------------------------------------
// Taken in the shop for coins, they last a few rounds.
export const ROGUE_CURSE_IDS = ["wrong_angle", "slow_paddle", "retro"] as const;
export const ROGUE_CURSE_ROUNDS = 3;
export const ROGUE_MAX_CURSES = 2;
/** Reward in shop price units, bigger for the curses that hurt more */
export const ROGUE_CURSE_REWARD_UNITS: Record<
  (typeof ROGUE_CURSE_IDS)[number],
  number
> = { slow_paddle: 15, wrong_angle: 20, retro: 25 }; // slow_paddle : hardest stage, see ROGUE_SLOW_PADDLE_STAGES
/** Largest launch angle error in radians, about 8 degrees */
export const ROGUE_WRONG_ANGLE = 0.14;
/**
 * Slow paddle comes in three stages : the slower the paddle, the bigger the reward.
 * speed : paddle speed limit, as a fraction of the play area width per frame.
 * units : reward in shop price units. The last stage is the original, hardest one.
 */
export const ROGUE_SLOW_PADDLE_STAGES = [
  { speed: 1 / 50, units: 6 },
  { speed: 1 / 80, units: 10 },
  { speed: 1 / 120, units: 15 },
] as const;
export const ROGUE_SLOW_PADDLE_MAX_STAGE = ROGUE_SLOW_PADDLE_STAGES.length;

/** Stages are numbered from 1. Anything unknown (old saves) is the hardest stage. */
export function slowPaddleStage(stage: number | undefined) {
  const n = Math.round(stage || ROGUE_SLOW_PADDLE_MAX_STAGE);
  return Math.min(ROGUE_SLOW_PADDLE_MAX_STAGE, Math.max(1, n));
}
export function slowPaddleSpeed(stage: number | undefined) {
  return ROGUE_SLOW_PADDLE_STAGES[slowPaddleStage(stage) - 1].speed;
}
export function slowPaddleRewardUnits(stage: number | undefined) {
  return ROGUE_SLOW_PADDLE_STAGES[slowPaddleStage(stage) - 1].units;
}
/** Paddle speed with the retro buttons, same unit */
export const ROGUE_RETRO_PADDLE_SPEED = 1 / 70;

/** Reward for taking a curse, in shop price units */
export function curseRewardUnits(
  id: (typeof ROGUE_CURSE_IDS)[number],
  slowStage?: number,
) {
  return id === "slow_paddle"
    ? slowPaddleRewardUnits(slowStage)
    : ROGUE_CURSE_REWARD_UNITS[id];
}

export function emptyCurses() {
  return { wrong_angle: 0, slow_paddle: 0, retro: 0 };
}

export function activeCurseIds(curses: Record<string, number> | undefined) {
  return ROGUE_CURSE_IDS.filter((id) => (curses?.[id] || 0) > 0);
}

/** The curse on offer in a shop : seeded, never one that is already active */
export function curseOffer(
  seed: number,
  round: number,
  curses: Record<string, number> | undefined,
) {
  if (activeCurseIds(curses).length >= ROGUE_MAX_CURSES) return undefined;
  const free = ROGUE_CURSE_IDS.filter((id) => !(curses?.[id] || 0));
  if (!free.length) return undefined;
  return free[
    Math.floor(mulberry32(mixSeed(seed, round, 313))() * free.length)
  ];
}

// ---- Reroll ---------------------------------------------------------------
export const ROGUE_REROLL_UNITS = 3;
/** Doubles with every reroll of the same shop or upgrade choice */
export function rerollPrice(bricks: number, rerolls: number) {
  return ROGUE_REROLL_UNITS * shopUnitPrice(bricks) * Math.pow(2, rerolls);
}

/**
 * A cell is a pinch when bedrock or a wall is on both sides of it. Balls
 * are bigger than they look, so one cell wide corridors are not counted as passable.
 * The bottom is open, it's where balls fall.
 */
function isPinch(bedrock: boolean[], size: number, x: number, y: number) {
  const blocked = (cx: number, cy: number) =>
    cx < 0 || cx >= size || cy < 0 || (cy < size && bedrock[cy * size + cx]);
  return (
    (blocked(x - 1, y) && blocked(x + 1, y)) ||
    (blocked(x, y - 1) && blocked(x, y + 1))
  );
}

/**
 * Every brick must be reachable from the bottom row without going through bedrock
 * or one cell wide corridors. Bricks themselves count as passable : they get broken.
 */
export function isLevelSolvable(
  occupied: boolean[],
  bedrock: boolean[],
  size: number,
) {
  const reached: boolean[] = new Array(size * size).fill(false);
  const queue: number[] = [];

  const allowed = (x: number, y: number) => {
    if (x < 0 || x >= size || y < 0 || y >= size) return false;
    const i = y * size + x;
    if (bedrock[i]) return false;
    if (occupied[i]) return true;
    return !isPinch(bedrock, size, x, y);
  };

  for (let x = 0; x < size; x++) {
    if (allowed(x, size - 1)) {
      reached[(size - 1) * size + x] = true;
      queue.push((size - 1) * size + x);
    }
  }
  while (queue.length) {
    const i = queue.pop() as number;
    const x = i % size,
      y = Math.floor(i / size);
    for (const [dx, dy] of [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ]) {
      const nx = x + dx,
        ny = y + dy;
      if (!allowed(nx, ny)) continue;
      const ni = ny * size + nx;
      if (reached[ni]) continue;
      reached[ni] = true;
      queue.push(ni);
    }
  }
  return occupied.every((o, i) => !o || reached[i]);
}

/**
 * Picks bedrock cells for a map. Bricks stay breakable and reachable, and the
 * bottom 40% of the map is never touched.
 * With allowReplace, bedrock may take the place of a brick (returned in clearedBricks).
 * Otherwise it only goes in empty cells next to a brick, so hand made pictures stay readable.
 */
export function placeBedrock(
  bricks: readonly string[],
  size: number,
  count: number,
  rng: () => number,
  allowReplace: boolean,
) {
  const bedrock: boolean[] = new Array(size * size).fill(false);
  const clearedBricks: number[] = [];
  if (count <= 0) return { bedrock, clearedBricks };

  const occupied = bricks.map((b) => !isEmptyCell(b));
  let lastBrickRow = 0;
  occupied.forEach((o, i) => {
    if (o) lastBrickRow = Math.max(lastBrickRow, Math.floor(i / size));
  });
  const maxRow = Math.min(lastBrickRow + 1, Math.floor(size * 0.6) - 1);

  const hasBrickNeighbour = (x: number, y: number) =>
    [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].some(([dx, dy]) => {
      const nx = x + dx,
        ny = y + dy;
      return (
        nx >= 0 && nx < size && ny >= 0 && ny < size && occupied[ny * size + nx]
      );
    });

  const candidates: number[] = [];
  for (let y = 0; y <= maxRow; y++) {
    for (let x = 0; x < size; x++) {
      const i = y * size + x;
      if (occupied[i] ? allowReplace : hasBrickNeighbour(x, y)) {
        candidates.push(i);
      }
    }
  }

  let remaining = shuffled(candidates, rng);
  let placed = 0;
  while (placed < count && remaining.length) {
    // Often grow an existing piece so bedrock forms short walls instead of dots
    let pickIndex = 0;
    if (placed && rng() < 0.6) {
      const next = remaining.findIndex((i) =>
        [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ].some(([dx, dy]) => {
          const nx = (i % size) + dx,
            ny = Math.floor(i / size) + dy;
          return (
            nx >= 0 &&
            nx < size &&
            ny >= 0 &&
            ny < size &&
            bedrock[ny * size + nx]
          );
        }),
      );
      if (next >= 0) pickIndex = next;
    }
    const [cell] = remaining.splice(pickIndex, 1);
    const wasBrick = occupied[cell];
    bedrock[cell] = true;
    occupied[cell] = false;
    if (isLevelSolvable(occupied, bedrock, size)) {
      placed++;
      if (wasBrick) clearedBricks.push(cell);
    } else {
      bedrock[cell] = false;
      occupied[cell] = wasBrick;
    }
  }
  return { bedrock, clearedBricks };
}
