import { GameState } from "./types";

import { t } from "./i18n/i18n";
import { toast } from "./toast";
import { schedulGameSound } from "./gameStateMutators";
import { getIcon } from "./levelIcon";
import { allLevels } from "./allLevels";
import {
  addToUnlockedLevels,
  getUnlockedLevelList,
} from "./unlocked_level_list";

let unlocked: Set<string> | null = null;

export function monitorLevelsUnlocks(gameState: GameState) {
  if (!unlocked) {
    unlocked = getUnlockedLevelList();
  }

  if (gameState.startParams.runType !== "normal") return;

  allLevels.forEach(({ name, minScore, forbidden, required }) => {
    // Already unlocked
    if (unlocked!.has(name)) return;
    // Score not reached yet
    if (gameState.score < minScore) return;
    if (!minScore) return;
    if (gameState.score < minScore) return;
    // We are missing a required perk
    if (required.find((id) => !gameState.perks[id])) return;
    // We have a forbidden perk
    if (forbidden.find((id) => gameState.perks[id])) return;
    // Level just got unlocked
    unlocked!.add(name);
    addToUnlockedLevels(name);
    toast(
      getIcon(name) + "<strong>" + t("unlocks.just_unlocked") + "</strong>",
    );
    schedulGameSound(gameState, "colorChange", 0, 1);
  });
}
