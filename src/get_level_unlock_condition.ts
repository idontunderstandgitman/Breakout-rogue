import {
  Level,
  PerkId,
  RunHistoryItem,
  UnlockCondition,
  Upgrade,
} from "./types";
import { hashCode } from "./getLevelBackground";

let excluded: Set<PerkId>;

function isExcluded(id: PerkId, upgrades: Upgrade[]) {
  if (!excluded) {
    excluded = new Set([
      "extra_levels",
      "one_more_choice",
      "shunt",
      "slow_down",
    ]);
    // Avoid excluding a perk that's needed for the required one
    upgrades.forEach((u) => {
      u.requires.forEach((r) => excluded.add(r));
    });
  }
  return excluded.has(id);
}

export function getLevelUnlockCondition(
  levelIndex: number,
  upgrades: Upgrade[],
): UnlockCondition {
  const result: UnlockCondition = {
    required: [],
    forbidden: [],
    minScore: Math.max(-1000 + 100 * levelIndex, 0),
  };

  if (levelIndex > 20) {
    const possibletargets = [...upgrades]
      .slice(0, Math.floor(levelIndex / 2))
      .filter((u) => !isExcluded(u.id, upgrades))
      .sort((a, b) => hashCode(levelIndex + a.id) - hashCode(levelIndex + b.id))
      .map((u) => u.id);

    const length = Math.min(3, Math.ceil(levelIndex / 30));
    result.required = possibletargets.slice(0, length);
    result.forbidden = possibletargets.slice(length, length + length);
  }
  return result;
}

export function getBestScoreMatching(
  history: RunHistoryItem[],
  required: PerkId[] = [],
  forbidden: PerkId[] = [],
) {
  return Math.max(
    0,
    ...history
      .filter(
        (r) =>
          !required.find((id) => !r?.perks?.[id]) &&
          !forbidden.find((id) => r?.perks?.[id]),
      )
      .map((r) => r.score),
  );
}

export function isLevelLocked(level: Level, history: RunHistoryItem[]) {
  return (
    getBestScoreMatching(history, level.required, level.forbidden) <
    level.minScore
  );
}
