import { GameState, Level, RunParams } from "./types";
import { getSettingValue, setSettingValue } from "./settings";
import { getHistory } from "./gameOver";
import { asyncAlert } from "./asyncAlert";
import { getCheckboxIcon, getIcon } from "./levelIcon";
import { miniMarkDown } from "./pure_functions";
import { describeLevel } from "./game_utils";
import { t } from "./i18n/i18n";
import { confirmRestart, mainGameState, restart } from "./game";
import { allLevels } from "./allLevels";
import { reasonLevelIsLocked } from "./reason_level_is_locked";
import {
  getSortedLevelsList,
  openUnlockedLevelsList,
  sortMethods,
} from "./openUnlockedLevelsList";
import { getUnlockedLevelList } from "./unlocked_level_list";

export async function openLevelDetails(level: Level) {
  const unlockedBefore = getUnlockedLevelList();

  const isLocked = !unlockedBefore.has(level.name);
  const lockReason = isLocked
    ? reasonLevelIsLocked(level, getHistory(), true)
    : null;

  const fullList = getSortedLevelsList().sorted;
  const activeLevels = fullList
    .filter((level) => unlockedBefore.has(level.name))
    .filter((level) => getSettingValue("offer-level-" + level.name, true));

  const allowedInGame = getSettingValue("offer-level-" + level.name, true);
  const allowDisabling = !allowedInGame || activeLevels?.length > 15;
  const tooFarInGame =
    mainGameState.currentLevel > 0 &&
    mainGameState.startParams.runType === "normal";

  const currentIndex = fullList.indexOf(level);
  const next = fullList[currentIndex + 1];
  const previous = fullList[currentIndex - 1];

  const action = await asyncAlert<string>({
    title: `<span class="perk-title">
    <button ${previous ? 'data-resolve-to="previous"' : "disabled"} data-tooltip="${t("unlocks.previous")}">‹ </button>
    <span>${level.name}</span>
    <button ${next ? 'data-resolve-to="next"' : "disabled"} data-tooltip="${t("unlocks.next")}">  ›</button></span> 
    `,
    content: [
      `<div class="full-width-icon">${getIcon(level.name, 350)}</div>`,
      miniMarkDown(level.credit || ""),
      ...sortMethods.map(
        ({ text, getVal }) =>
          text() + ": " + getVal({ l: level, unlockedBefore }).label,
      ),
      lockReason ? t("unlocks.unlock_condition") + lockReason.text : "",

      {
        value: "run",
        icon: getIcon("icon:new_run"),
        text: t("unlocks.try"),
        disabled: isLocked,
      },
      {
        icon: getCheckboxIcon(allowedInGame),
        value: "toggle-offer-level",
        text: t("unlocks.include_in_level_pool"),
        help:
          (tooFarInGame &&
            t("unlocks.include_in_unlock_not_during_gameplay")) ||
          (!allowDisabling && t("unlocks.include_in_level_pool_locked")) ||
          (isLocked && t("unlocks.include_in_unlock_hints_help")) ||
          t("unlocks.include_in_level_pool_help"),
        disabled: !allowDisabling || tooFarInGame,
      },
    ],
    allowClose: true,
  });
  if (!action) return openUnlockedLevelsList();
  if (action === "run") {
    if (await confirmRestart(mainGameState)) {
      restart({ runType: "level_preview_run", level } as RunParams);
      setSettingValue("autosave", null);
      return;
    }
  }
  if (action === "toggle-offer-level") {
    setSettingValue("offer-level-" + level.name, !allowedInGame);
  }
  if (next && action === "next") {
    return openLevelDetails(next);
  }
  if (previous && action === "previous") {
    return openLevelDetails(previous);
  }
  await openLevelDetails(level);
}

export function closeLevelPreview(gameState: GameState) {
  openLevelDetails(gameState.level);
  restart({ runType: "normal" });
}
