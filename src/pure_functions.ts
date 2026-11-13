import { Ball, GameState, ReusableArray } from "./types";

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(value, max));
}

export function ballTransparency(ball: Ball, gameState: GameState) {
  if (!gameState.perks.transparency) return 0;
  return clamp(
    gameState.perks.transparency *
      (1 - (ball.y / gameState.gameZoneHeight) * 1.2),
    0,
    1,
  );
}

export function applyComboBoost(gameState: GameState, comboIncrease: number) {
  let boost =
    1 +
    gameState.perks.sturdy_bricks / 2 +
    gameState.perks.smaller_puck / 2 +
    gameState.perks.transparency / 2;

  if (gameState.perks.minefield) {
    gameState.bricks.forEach((brick) => {
      if (brick === "black") {
        boost += 0.1 * gameState.perks.minefield;
      }
    });
  }

  // double_or_nothing is applied last and also boosts other combos boosts
  const float = comboIncrease * boost * (1 + gameState.perks.double_or_nothing);
  const floor = Math.floor(float);
  // round up or down randomly based on excess amount
  return floor + (float - floor > Math.random() ? 1 : 0);
}

export function miniMarkDown(md: string) {
  let html: { tagName: string; text: string }[] = [];
  let lastNode: { tagName: string; text: string } | null = null;

  md.split("\n").forEach((line) => {
    const titlePrefix = line.match(/^#+ /)?.[0];

    if (titlePrefix) {
      if (lastNode) html.push(lastNode);
      lastNode = {
        tagName: "h" + (titlePrefix.length - 1),
        text: line.slice(titlePrefix.length),
      };
    } else if (line.startsWith("- ")) {
      if (lastNode?.tagName !== "ul") {
        if (lastNode) html.push(lastNode);
        lastNode = { tagName: "ul", text: "" };
      }
      lastNode.text += "<li>" + line.slice(2) + "</li>";
    } else if (!line.trim()) {
      if (lastNode) html.push(lastNode);
      lastNode = null;
    } else {
      if (lastNode?.tagName !== "p") {
        if (lastNode) html.push(lastNode);
        lastNode = { tagName: "p", text: "" };
      }
      lastNode.text += line + " ";
    }
  });
  if (lastNode) {
    html.push(lastNode);
  }
  return html
    .map(
      (h) =>
        "<" +
        h.tagName +
        ">" +
        h.text.replace(
          /\bhttps?:\/\/[^\s<>]+/gi,
          (a) => `<a href="${a}" target="_blank">${a}</a>`,
        ) +
        "</" +
        h.tagName +
        ">",
    )
    .join("\n");
}

export function firstWhere<Input, Output>(
  arr: Input[],
  mapper: (item: Input, index: number) => Output | undefined,
): Output | undefined {
  for (let i = 0; i < arr.length; i++) {
    const result = mapper(arr[i], i);
    if (typeof result !== "undefined") return result;
  }
}

export const levelTimeBest = 25,
  levelTimeGood = 45,
  catchRateBest = 98,
  catchRateGood = 90,
  missesBest = 1,
  missesGood = 6,
  choicePerSilver = 1,
  choicePerGold = 3,
  upPerSilver = 1,
  upPerGold = 1;

export const MAX_LEVEL_SIZE = 24;
export const MIN_LEVEL_SIZE = 2;

export function automaticBackgroundColor(bricks: string[]) {
  return bricks.filter((b) => b === "g").length >
    bricks.filter((b) => b !== "_").length * 0.05
    ? "#115988"
    : "#000000";
}

export function comboKeepingRate(level: number) {
  return clamp(1 - (1 / (1 + level)) * 1.5, 0, 1);
}

export function base_combo_from_stronger_foundation(perkLevel: number) {
  let base = 1;
  for (let i = 0; i < perkLevel; i++) {
    base += 4 + i * 2;
  }
  return base;
}

const computerControlledRunTypes = new Set([
  "animated_perk_preview",
  "stress",
  "autoplay",
]);
export function isComputerControlled(gameState: GameState) {
  return computerControlledRunTypes.has(gameState.startParams.runType);
}

export function getNewReusableArray<T>() {
  return {
    indexMin: 0,
    total: 0,
    list: [] as T[],
  };
}

export function getRowColIndex(gameState: GameState, row: number, col: number) {
  if (
    row < 0 ||
    col < 0 ||
    row >= gameState.gridSize ||
    col >= gameState.gridSize
  )
    return -1;
  return row * gameState.gridSize + col;
}

export function countDifferentColorBricks(
  gameState: GameState,
  index: number,
  color: string,
  colorsCount: number,
) {
  const baseX = index % gameState.gridSize;
  const baseY = Math.floor(index / gameState.gridSize);
  let sameColor = 0;
  let differentColor = 0;
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      if (!dx && !dy) continue;
      const neighbor =
        gameState.bricks[getRowColIndex(gameState, baseY + dy, baseX + dx)];
      if (neighbor && neighbor !== "black") {
        if (neighbor === color) {
          sameColor++;
        } else {
          differentColor++;
        }
      }
    }
  }
  if (differentColor >= 1) {
    return differentColor;
  } else if (sameColor && colorsCount > 1) {
    return -1;
  } else {
    return 0;
  }
}
export function append<T extends { destroyed?: boolean | undefined }>(
  where: ReusableArray<T>,
  makeItem: (match: Partial<T>) => void,
) {
  while (
    where.list[where.indexMin] &&
    !where.list[where.indexMin].destroyed &&
    where.indexMin < where.list.length
  ) {
    where.indexMin++;
  }
  if (where.indexMin < where.list.length) {
    where.list[where.indexMin].destroyed = false;
    makeItem(where.list[where.indexMin]);
    where.indexMin++;
  } else {
    const p = { destroyed: false };
    makeItem(p as T);
    where.list.push(p as T);
  }
  where.total++;
}

export function destroy<T extends { destroyed?: boolean }>(
  where: ReusableArray<T>,
  index: number,
) {
  if (where.list[index].destroyed) return;
  where.list[index].destroyed = true;
  where.indexMin = Math.min(where.indexMin, index);
  where.total--;
}

export function liveCount<T extends { destroyed?: boolean }>(
  where: ReusableArray<T>,
) {
  return where.total;
}

export function empty<T extends { destroyed?: boolean }>(
  where: ReusableArray<T>,
) {
  let destroyed = 0;
  where.total = 0;
  where.indexMin = 0;
  where.list.forEach((i) => {
    if (!i.destroyed) {
      i.destroyed = true;
      destroyed++;
    }
  });
  return destroyed;
}
export function forEachLiveOne<T extends { destroyed?: boolean }>(
  where: ReusableArray<T>,
  cb: (t: T, index: number) => void,
) {
  where.list.forEach((item: T, index: number) => {
    if (item && !item.destroyed) {
      cb(item, index);
    }
  });
}
