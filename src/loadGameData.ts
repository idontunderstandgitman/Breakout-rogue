import { Level, Palette, RawLevel, UnlockCondition, Upgrade } from "./types";
import _palette from "./data/palette.json";
import _rawLevelsList from "./data/levels.json";
import _appVersion from "./data/version.json";
import { rawUpgrades } from "./upgrades";
import { getLevelBackground } from "./getLevelBackground";

import { automaticBackgroundColor } from "./pure_functions";
import _hardCodedCondition from "./data/unlockConditions.json";

export const upgrades = [...rawUpgrades].sort(
  (a, b) => a.category - b.category || a.threshold - b.threshold,
) as unknown as Upgrade[];
export const palette = _palette as Palette;

const rawLevelsList = _rawLevelsList as RawLevel[];

export const appVersion = _appVersion as string;

export function transformRawLevel(level: RawLevel) {
  const splitBricks = level.bricks.split("");
  const bricks = splitBricks
    .map((c) => palette[c])
    .slice(0, level.size * level.size);
  const bricksCount = bricks.filter((i) => i).length;
  return {
    ...level,
    bricks,
    bricksCount,
    color: automaticBackgroundColor(splitBricks),
    svg: getLevelBackground(level),
    sortKey: ((Math.random() + 3) / 3.5) * bricksCount,
  };
}

export const allLevelsAndIcons = rawLevelsList.map(
  transformRawLevel,
) as Level[];

export const hardCodedCondition = _hardCodedCondition as Record<
  string,
  UnlockCondition
>;
