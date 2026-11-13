import { ROGUE_EXCLUDED_PERKS, isRogue, isRogueTest } from "./rogue_generator";
import {
  Ball,
  Coin,
  colorString,
  GameState,
  Level,
  ParticleFlash,
  PerkId,
  PerksMap,
  Upgrade,
} from "./types";
import { upgrades } from "./loadGameData";
import { t } from "./i18n/i18n";
import { append, clamp } from "./pure_functions";
import { getSettingValue, getTotalScore, setSettingValue } from "./settings";
import { isOptionOn } from "./options";
import { getIcon } from "./levelIcon";

export function describeLevel(level: Level) {
  let bricks = 0,
    colors = new Set(),
    bombs = 0;
  level.bricks.forEach((color) => {
    if (!color) return;
    if (color === "black") {
      bombs++;
      return;
    } else {
      colors.add(color);
      bricks++;
    }
  });
  return t("unlocks.level_description", {
    size: level.size,
    bricks,
    colors: colors.size,
    bombs,
  });
}

export function getMajorityValue(arr: string[]): string {
  const count: { [k: string]: number } = {};
  arr.forEach((v) => (count[v] = (count[v] || 0) + 1));
  // Object.values inline polyfill
  const max = Math.max(...Object.keys(count).map((k) => count[k]));
  return sample(Object.keys(count).filter((k) => count[k] == max));
}

export function sample<T>(arr: T[]): T {
  return arr[Math.floor(arr.length * Math.random())];
}

export function sumOfValues(obj: { [key: string]: number } | undefined | null) {
  let sum = 0;
  if (obj)
    for (let k in obj) {
      sum += obj[k];
    }
  return sum;
}

export const makeEmptyPerksMap = (upgrades: { id: PerkId }[]) => {
  const p = {} as any;
  upgrades.forEach((u) => (p[u.id] = 0));
  return p as PerksMap;
};

export function brickCenterX(gameState: GameState, index: number) {
  return (
    gameState.offsetX +
    ((index % gameState.gridSize) + 0.5) * gameState.brickWidth
  );
}

export function brickCenterY(gameState: GameState, index: number) {
  return (Math.floor(index / gameState.gridSize) + 0.5) * gameState.brickWidth;
}

export function getClosestBall(
  gameState: GameState,
  x: number,
  y: number,
): Ball | null {
  let closestBall: Ball | null = null;
  let dist = 0;
  gameState.balls.forEach((ball) => {
    const d2 = (ball.x - x) * (ball.x - x) + (ball.y - y) * (ball.y - y);
    if (d2 < dist || !closestBall) {
      closestBall = ball;
      dist = d2;
    }
  });
  return closestBall;
}
export function getPossibleUpgrades(gameState: GameState) {
  const testRun = isRogueTest(gameState);
  return (
    upgrades
      // Rogue test runs offer every upgrade, locked or not
      .filter((u) => testRun || getTotalScore() >= u.threshold)
      .filter((u) => testRun || getSettingValue("offer-upgrade-" + u.id, true))
      .filter(
        (u) =>
          !(
            isRogue(gameState) &&
            // Only the ones that would end the run are left out of test runs
            (testRun
              ? u.id === "chill" || u.id === "extra_levels"
              : ROGUE_EXCLUDED_PERKS.includes(u.id))
          ),
      )
      .filter(
        (u) =>
          u.requires.length === 0 || u.requires.find((r) => gameState.perks[r]),
      )
      // Synergy : needs BOTH perks, and only exists in rogue runs
      .filter(
        (u) =>
          u.id !== "electrocute" ||
          (isRogue(gameState) &&
            gameState.perks.multiball > 0 &&
            gameState.perks.ball_attract_ball > 0),
      )
  );
}

export function renderMaxLevel(gameState: GameState) {
  return gameState.perks.chill || isRogue(gameState)
    ? "∞"
    : max_levels(gameState);
}
export function max_levels(gameState: GameState) {
  // Rogue runs only end when you lose
  if (isRogue(gameState)) return Infinity;
  if (gameState.startParams.runType !== "normal") return 1;
  if (gameState.perks.chill) return gameState.currentLevel + 2;
  return 7 + gameState.perks.extra_levels;
}

export function upgradeLevelAndMaxDisplay(
  upgrade: Upgrade,
  gameState: GameState,
) {
  const lvl = gameState.perks[upgrade.id];
  const max = upgrade.max + gameState.perks.limitless;
  return levelAndMaxBadge(lvl, max);
}

export function levelAndMaxBadge(lvl: number, max: number) {
  return ` <span class="level ${lvl < max ? "can-upgrade" : "capped"}"><span>${lvl}</span><span>${max}</span></span>`;
}

export function levelsListHTMl(
  gameState: GameState,
  currentLevelIndex: number,
) {
  if (!gameState.perks.clairvoyant) return "";
  if (gameState.startParams.runType !== "normal") return "";
  let list = "";
  for (let i = 0; i < max_levels(gameState); i++) {
    let level = gameState.runLevels[i % gameState.runLevels.length];
    list += `<span style="opacity: ${i >= currentLevelIndex ? 1 : 0.2}" title="${level.name}">${getIcon(level.name)}</span>`;
  }
  return `<p>${t("score_panel.upcoming_levels")}</p><p>${list}</p>`;
}

export function currentLevelInfo(gameState: GameState) {
  return gameState.level;
}

export function isPickyEatingPossible(gameState: GameState) {
  return gameState.bricks.indexOf(gameState.ballsColor) !== -1;
}

export function reachRedRowIndex(gameState: GameState) {
  if (!gameState.perks.reach) return -1;
  const { size } = gameState.level;
  let minY = -1,
    maxY = -1,
    maxYCount = -1;
  for (let y = 0; y < size; y++)
    for (let x = 0; x < size; x++)
      if (gameState.bricks[x + y * size]) {
        if (minY == -1) minY = y;
        if (maxY < y) {
          maxY = y;
          maxYCount = 0;
        }
        if (maxY == y) maxYCount++;
      }

  if (maxY < 1) return -1;
  if (maxY == minY) return -1;
  if (maxYCount === size) return -1;
  return maxY;
}

export function telekinesisEffectRate(gameState: GameState, ball: Ball) {
  return (
    (gameState.perks.telekinesis &&
      ball.vy < 0 &&
      clamp((ball.y / gameState.gameZoneHeight) * 1.1 + 0.1, 0, 1)) ||
    0
  );
}

export function yoyoEffectRate(gameState: GameState, ball: Ball) {
  if (ball.vy < 0) return 0;
  if (!gameState.perks.yoyo) return 0;
  return (
    (((Math.abs(gameState.puckPosition - ball.x) / gameState.gameZoneWidth) *
      gameState.perks.yoyo) /
      2) *
    clamp(1 - ball.y / gameState.gameZoneHeight, 0, 1) *
    2
  );
}

export function findLast<T>(
  arr: T[],
  predicate: (item: T, index: number, array: T[]) => boolean,
) {
  let i = arr.length;
  while (--i)
    if (predicate(arr[i], i, arr)) {
      return arr[i];
    }
}

export function distance2(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  return Math.pow(a.x - b.x, 2) + Math.pow(a.y - b.y, 2);
}

export function distanceBetween(
  a: { x: number; y: number },
  b: { x: number; y: number },
) {
  return Math.sqrt(distance2(a, b));
}

export function defaultSounds() {
  return {
    aboutToPlaySound: {
      wallBeep: { vol: 0, x: 0 },
      comboIncreaseMaybe: { vol: 0, x: 0 },
      comboDecrease: { vol: 0, x: 0 },
      coinBounce: { vol: 0, x: 0 },
      explode: { vol: 0, x: 0 },
      lifeLost: { vol: 0, x: 0 },
      coinCatch: { vol: 0, x: 0 },
      plouf: { vol: 0, x: 0 },
      colorChange: { vol: 0, x: 0 },
    },
  };
}

export function shouldPierceByColor(
  gameState: GameState,
  hitBrick: number | undefined,
) {
  return (
    gameState.perks.pierce_color &&
    typeof hitBrick !== "undefined" &&
    gameState.bricks[hitBrick] === gameState.ballsColor
  );
}

export function isMovingWhilePassiveIncome(gameState: GameState) {
  return !!(
    gameState.lastPuckMove &&
    gameState.perks.passive_income &&
    gameState.lastPuckMove >
      gameState.levelTime - (100 * gameState.perks.passive_income - 50)
  );
}

export function getHighScore() {
  try {
    return BigInt(
      parseFloat(localStorage.getItem("breakout-3-hs-short") || "0"),
    );
  } catch (e) {}
  return BigInt(0);
}
export function largestDivisorUnder5(n: number) {
  for (let i = Math.min(Math.floor(n / 2), 5); i >= 2; i--) {
    if (n % i == 0) {
      return i;
    }
  }
  return 1;
}
export function getCoinRenderColor(gameState: GameState, coin: Coin) {
  if (
    gameState.perks.metamorphosis ||
    isOptionOn("colorful_coins") ||
    gameState.perks.sticky_coins ||
    gameState.perks.rainbow
  )
    return coin.color;
  return "#ffd300";
}

export function getCornerOffset(gameState: GameState) {
  return (
    (gameState.levelTime
      ? gameState.perks.corner_shot * gameState.brickWidth
      : 0) -
    gameState.perks.unbounded * gameState.brickWidth
  );
}

export const isInWebView = !!window.location.href.includes("isInWebView=true");

export function hoursSpentPlaying() {
  try {
    const timePlayed = getSettingValue("breakout_71_total_play_time", 0);
    return Math.floor(timePlayed / 1000 / 60 / 60);
  } catch (e) {
    return 0;
  }
}

export function escapeAttribute(str: String) {
  return str
    .replace(/&/gi, "&amp;")
    .replace(/</gi, "&lt;")
    .replace(/"/gi, "&quot;")
    .replace(/'/gi, "&#39;");
}

export function canvasCenterX(gameState: GameState) {
  return gameState.canvasWidth / 2;
}
export function zoneLeftBorderX(gameState: GameState) {
  return gameState.offsetXRoundedDown - 1;
}
export function zoneRightBorderX(gameState: GameState) {
  return gameState.canvasWidth - gameState.offsetXRoundedDown + 1;
}

let countsCounterSet: Record<string, number> = {};
export function countBrickColors(gameState: GameState) {
  for (let key in countsCounterSet) {
    countsCounterSet[key] = 0;
  }
  gameState.bricks.forEach((brick) => {
    if (brick && brick !== "black") countsCounterSet[brick] = 1;
  });
  return sumOfValues(countsCounterSet);
}

export function isBrickOverPaddle(gameState: GameState, brickIndex: number) {
  const x = brickCenterX(gameState, brickIndex);

  return (
    x + gameState.brickWidth / 2 >
      gameState.puckPosition - gameState.puckWidth / 2 &&
    x - gameState.brickWidth / 2 <
      gameState.puckPosition + gameState.puckWidth / 2
  );
}
export function baseBrickHP(gameState: GameState) {
  return 1 + gameState.perks.sturdy_bricks;
}
export function makeParticle(
  gameState: GameState,
  x: number,
  y: number,
  vx: number,
  vy: number,
  color: colorString,
  ethereal = false,
  size = 8,
  duration = 150,
) {
  if (!color.match(/^#[a-f0-9]{6}$/gi)) {
    throw new Error("Particle creation ignored, invalid color : " + color);
  }
  if (!isOptionOn("particles")) return;
  append(gameState.particles, (p: Partial<ParticleFlash>) => {
    p.time = gameState.levelTime;
    p.x = x;
    p.y = y;
    p.vx = vx;
    p.vy = vy;
    p.color = color;
    p.size = size;
    p.duration = duration;
    p.ethereal = ethereal;
  });
}
