import {
  commitSettingsChangesToLocalStorage,
  getSettingValue,
  setSettingValue,
} from "./settings";
import { allLevels } from "./allLevels";

export function getUnlockedLevelList() {
  return new Set<string>(
    getSettingValue("breakout_71_unlocked_levels", []).map((l: string) =>
      l.trim(),
    ),
  );
}

export function addToUnlockedLevels(name: string) {
  setSettingValue(
    "breakout_71_unlocked_levels",
    [...getUnlockedLevelList()].concat([name]),
  );
}

window.unlock_all = function () {
  setSettingValue("breakout_71_total_score", 9999999999);
  setSettingValue(
    "breakout_71_unlocked_levels",
    allLevels.map((l) => l.name),
  );
  commitSettingsChangesToLocalStorage();
  window.location.reload();
};
