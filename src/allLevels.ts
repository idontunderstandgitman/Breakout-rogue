import { getLevelUnlockCondition } from "./get_level_unlock_condition";
import {
  allLevelsAndIcons,
  hardCodedCondition,
  upgrades,
} from "./loadGameData";

export const allLevels = allLevelsAndIcons
  .filter((l) => !l.name.startsWith("icon:"))
  .map((l, li) => ({
    ...l,
    ...(hardCodedCondition[l.name] || getLevelUnlockCondition(li, upgrades)),
  }))
  .sort((a, b) => a.minScore - b.minScore);
