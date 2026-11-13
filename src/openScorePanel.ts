import { GameState, PerkId } from "./types";
import { asyncAlert } from "./asyncAlert";
import { t } from "./i18n/i18n";
import { levelsListHTMl, renderMaxLevel } from "./game_utils";
import { getHistory } from "./gameOver";
import { pause } from "./game";
import { upgrades } from "./loadGameData";
import { firstWhere } from "./pure_functions";
import { getSettingValue, getTotalScore } from "./settings";
import { isOptionOn } from "./options";
import { getIcon } from "./levelIcon";
import { closeLevelPreview } from "./openLevelDetails";
import { closeEditorTrialRun } from "./levelEditor";
import { closeCreativeRun } from "./creative";
import { pickedUpgradesHTMl } from "./picked_upgrades_html";
import { allLevels } from "./allLevels";
import { reasonLevelIsLocked, upgradeName } from "./reason_level_is_locked";
import { getUnlockedLevelList } from "./unlocked_level_list";

export async function openScorePanel(gameState: GameState) {
  pause(true);

  if (gameState.startParams.runType === "level_preview_run") {
    return closeLevelPreview(gameState);
  }
  if (gameState.startParams.runType === "level_editor_trial") {
    return closeEditorTrialRun();
  }
  if (gameState.startParams.runType === "creative") {
    return closeCreativeRun(gameState);
  }

  await asyncAlert({
    id: "score_panel",
    title: t("score_panel.title", {
      score: gameState.score,
      level: gameState.currentLevel + 1,
      max: renderMaxLevel(gameState),
    }),

    content: [
      pickedUpgradesHTMl(gameState),
      levelsListHTMl(gameState, gameState.currentLevel),
      getNearestUnlockHTML(gameState),
      gameState.rerolls
        ? t("score_panel.upgrade_point_count", {
            count: gameState.rerolls,
          })
        : "",
    ],
    allowClose: true,
  });
}

export function getFirstUnlockable(gameState: GameState) {
  if (gameState.startParams.runType !== "normal") return undefined;
  const unlocked = getUnlockedLevelList();

  return firstWhere(allLevels, (l, li) => {
    if (unlocked.has(l.name)) return;
    if (!getSettingValue("offer-level-" + l.name, true)) return;
    const reason = reasonLevelIsLocked(l, getHistory(), false);
    if (!reason) return;

    const { minScore, forbidden, required } = l;
    const missing: PerkId[] = required.filter((id) => !gameState?.perks?.[id]);
    // we can't have a forbidden perk
    if (forbidden.find((id) => gameState?.perks?.[id])) {
      return;
    }

    // All required upgrades need to be unlocked
    if (
      missing.find(
        (id) => upgrades.find((u) => u.id === id)!.threshold > getTotalScore(),
      )
    ) {
      return;
    }

    return {
      l,
      li,
      minScore,
      forbidden,
      required,
      missing,
      reason,
    };
  });
}

export function getNearestUnlockHTML(gameState: GameState) {
  if (!isOptionOn("level_unlocks_hints")) return "";
  const firstUnlockable = getFirstUnlockable(gameState);

  if (!firstUnlockable) return "";
  let missingPoints = Math.max(0, firstUnlockable.minScore - gameState.score);
  let missingUpgrades = firstUnlockable.missing
    .map((id) => upgradeName(id))
    .join(", ");

  const title =
    (missingUpgrades &&
      t("score_panel.get_upgrades_to_unlock", {
        missingUpgrades,
        points: missingPoints,
        level: firstUnlockable.l.name,
      })) ||
    t("score_panel.score_to_unlock", {
      points: missingPoints,
      level: firstUnlockable.l.name,
    });

  return `
    <p>${t("score_panel.close_to_unlock")}</p>
    <div class="upgrade">
          ${getIcon(firstUnlockable.l.name)}
          <p>
          <strong>${title}</strong>
        ${firstUnlockable.reason?.text}
        </p>  
      </div>
  
  `;
}
