import { Level, PerkId, RunHistoryItem } from "./types";
import { t } from "./i18n/i18n";
import { getBestScoreMatching } from "./get_level_unlock_condition";
import { upgrades } from "./loadGameData";

export function reasonLevelIsLocked(
  level: Level,
  history: RunHistoryItem[],
  mentionBestScore: boolean,
): null | { reached: number; minScore: number; text: string } {
  const { required, forbidden, minScore } = level;
  if (!required) {
    debugger;
  }
  const reached = getBestScoreMatching(history, required, forbidden);
  let reachedText =
    reached && mentionBestScore ? t("unlocks.reached", { reached }) : "";
  if (reached >= minScore) {
    return null;
  } else if (!required.length && !forbidden.length) {
    return {
      reached,
      minScore,
      text: t("unlocks.minScore", { minScore }) + reachedText,
    };
  } else {
    const tparams = {
      minScore,
      required: required.map((u) => upgradeName(u)).join(", "),
      forbidden: forbidden.map((u) => upgradeName(u)).join(", "),
    };
    return {
      reached,
      minScore,
      text:
        (forbidden.length
          ? t("unlocks.minScoreWithPerks", tparams)
          : t("unlocks.minScoreWithPerksNoForbidden", tparams)) + reachedText,
    };
  }
}

export function upgradeName(id: PerkId) {
  return upgrades.find((u) => u.id == id)!.name;
}
