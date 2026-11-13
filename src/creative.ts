import { GameState, Level, PerkId, RawLevel, Upgrade } from "./types";
import { transformRawLevel, upgrades } from "./loadGameData";
import { t } from "./i18n/i18n";
import { getSettingValue, getTotalScore, setSettingValue } from "./settings";
import {
  confirmRestart,
  creativeModeThreshold,
  mainGameState,
  restart,
} from "./game";
import { asyncAlert } from "./asyncAlert";
import { describeLevel, levelAndMaxBadge, sumOfValues } from "./game_utils";
import { getHistory } from "./gameOver";
import { noCreative } from "./upgrades";
import { getIcon, levelIconHTML } from "./levelIcon";
import { allLevels } from "./allLevels";
import { reasonLevelIsLocked } from "./reason_level_is_locked";
import { getUnlockedLevelList } from "./unlocked_level_list";

export function creativeMode(gameState: GameState) {
  return {
    icon: getIcon("icon:creative"),
    text: t("lab.menu_entry"),
    help:
      (getTotalScore() < creativeModeThreshold &&
        t("lab.unlocks_at", { score: creativeModeThreshold })) ||
      t("lab.help"),
    disabled: getTotalScore() < creativeModeThreshold,
    async value() {
      openCreativeModePerksPicker();
    },
  };
}

export async function openCreativeModePerksPicker() {
  let creativeModePerks: Partial<{ [id in PerkId]: number }> = getSettingValue(
    "creativeModePerks",
    {},
  );
  const customLevels = (getSettingValue("custom_levels", []) as RawLevel[]).map(
    transformRawLevel,
  );
  const unlockedBefore = getUnlockedLevelList();

  while (true) {
    const levelOptions = [
      ...allLevels.map((l, li) => {
        const problem = reasonLevelIsLocked(l, getHistory(), true)?.text || "";
        return {
          icon: getIcon(l.name),
          text: l.name,
          value: l,
          disabled: !unlockedBefore.has(l.name),
          tooltip: problem || describeLevel(l),
          className: "",
        };
      }),
      ...customLevels.map((l) => ({
        icon: levelIconHTML(l.bricks, l.size),
        text: l.name,
        value: l,
        disabled: !l.bricks.filter((b) => b !== "_").length,
        tooltip: describeLevel(l),
        className: "",
      })),
    ];

    const selectedLeveOption =
      levelOptions.find(
        (l) => l.text === getSettingValue("creativeModeLevel", ""),
      ) || levelOptions[0];
    selectedLeveOption.className = "highlight";

    const choice = await asyncAlert<Upgrade | Level | "reset" | "play">({
      title: t("lab.menu_entry"),
      className: "actionsAsGrid",
      content: [
        {
          icon: getIcon("icon:reset"),
          value: "reset",
          text: t("lab.reset"),
          disabled: !sumOfValues(creativeModePerks),
        },
        {
          icon: getIcon("icon:new_run"),
          value: "play",
          text: t("lab.play"),
          disabled: !sumOfValues(creativeModePerks),
        },

        t("lab.instructions"),
        ...upgrades
          .filter((u) => !noCreative.includes(u.id))
          .map((u) => ({
            icon: getIcon("icon:" + u.id),
            text: u.name,
            help: levelAndMaxBadge(
              creativeModePerks[u.id] || 0,
              Math.min(u.max + (creativeModePerks.limitless || 0), u.hardLimit),
            ),
            value: u,
            className:
              " upgrade " +
              (creativeModePerks[u.id] ? " highlight" : " not-highlighed"),
          })),
        t("lab.select_level"),
        ...levelOptions,
      ],
    });
    if (!choice) return;
    if (choice === "reset") {
      upgrades.forEach((u) => {
        creativeModePerks[u.id] = 0;
      });
      setSettingValue("creativeModePerks", creativeModePerks);
      setSettingValue("creativeModeLevel", "");
    } else if (
      choice === "play" ||
      ("bricks" in choice &&
        choice.name == getSettingValue("creativeModeLevel", ""))
    ) {
      if (await confirmRestart(mainGameState)) {
        restart({
          runType: "creative",
          perks: creativeModePerks,
          level: selectedLeveOption.value,
        });
        setSettingValue("autosave", null);
        return;
      }
    } else if ("bricks" in choice) {
      setSettingValue("creativeModeLevel", choice.name);
    } else if (choice) {
      creativeModePerks[choice.id] =
        ((creativeModePerks[choice.id] || 0) + 1) %
        (Math.min(
          choice.max + (creativeModePerks.limitless || 0),
          choice.hardLimit,
        ) +
          1);

      setSettingValue("creativeModePerks", creativeModePerks);
    }
  }
}

export function closeCreativeRun(gameState: GameState) {
  openCreativeModePerksPicker();
  restart({ runType: "normal" });
}
