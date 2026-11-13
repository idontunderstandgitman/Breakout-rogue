import { PerkId, RunParams, Upgrade } from "./types";
import { getSettingValue, getTotalScore, setSettingValue } from "./settings";
import { categories, rawUpgrades } from "./upgrades";
import { currentLevelInfo, getHighScore, sample } from "./game_utils";
import { upgrades } from "./loadGameData";
import { getIcon } from "./levelIcon";
import { t } from "./i18n/i18n";
import { mainGameState, restart } from "./game";
import { asyncAlert } from "./asyncAlert";
import { getUpgradeHelp } from "./openUpgradesPicker";
import { formatFullNumber } from "./format_number";

export function getStartingPerks(excluded: PerkId[] = []) {
  const favorite = getSettingValue<string>("starting_perk", "");

  const allowed = possibleStartingPerks().filter(
    (u) => !excluded.includes(u.id),
  );
  let upgrade: Upgrade = allowed.find((u) => u.id === favorite) as Upgrade;
  if (!upgrade) {
    upgrade = sample(
      allowed.filter((u) => u.category === categories.combo),
    ) as Upgrade;
  }

  let perks: RunParams["perks"] = { [upgrade.id]: 1 };
  if (upgrade.requires.length) {
    perks[sample(upgrade.requires) as PerkId] = 1;
  }

  return {
    mainPerkId: upgrade.id as PerkId,
    name: rawUpgrades
      .filter((u) => perks[u.id])
      .map((u) => u.name)
      .join(" + "),
    perks,
  };
}

function possibleStartingPerks() {
  return upgrades.filter((u) => u.threshold <= getTotalScore()) as Upgrade[];
}

export function getStartRunButtons() {
  const favorite = getSettingValue<string>("starting_perk", "");
  const hs = favorite
    ? getSettingValue("starting_" + favorite + "_hs", 0)
    : getHighScore();

  return [
    {
      icon: favorite ? getIcon("icon:" + favorite) : getIcon("icon:new_run"),
      text: favorite
        ? t("main_menu.normal_with_perk", {
            perk: upgrades.find((u) => u.id === favorite)?.name || favorite,
          })
        : t("main_menu.normal"),
      help: hs
        ? t("main_menu.high_score", { score: formatFullNumber(hs) + " $" })
        : t("main_menu.normal_help"),
      value: () => {
        restart({
          runType: "normal",
          levelToAvoid: currentLevelInfo(mainGameState).name,
        });
      },
    },
    {
      icon: getIcon("icon:limitless"),
      text: t("rogue.menu_entry"),
      help: getSettingValue("rogue_best_round", 0)
        ? t("rogue.menu_help_best", {
            round: getSettingValue("rogue_best_round", 0),
            score: formatFullNumber(getSettingValue("rogue_hs", 0)) + " $",
          })
        : t("rogue.menu_help"),
      value: () => {
        restart({
          runType: "rogue",
          levelToAvoid: currentLevelInfo(mainGameState).name,
        });
      },
    },
    {
      icon: getIcon("icon:limitless"),
      text: t("rogue.test_entry"),
      help: t("rogue.test_help"),
      value: () => {
        restart({
          runType: "rogue",
          testMode: true,
          levelToAvoid: currentLevelInfo(mainGameState).name,
        });
      },
    },
    {
      icon: getIcon("icon:custom_start"),
      text: t("main_menu.starting_perk"),
      help: t("main_menu.starting_perk_help"),
      value: async () => {
        const choice = await asyncAlert({
          title: t("main_menu.starting_perk"),
          content: [
            t("main_menu.starting_perk_intro"),
            {
              icon: getIcon("icon:random"),
              value: "starting_perk:",
              text: t("main_menu.random_perk"),
              help: t("main_menu.random_perk_help"),
            },
            ...possibleStartingPerks().map((u) => {
              const hs = getSettingValue("starting_" + u.id + "_hs", 0);
              return {
                icon: getIcon("icon:" + u.id),
                value: "starting_perk:" + u.id,
                text: u.name,
                disabled: u.threshold > getTotalScore(),
                help:
                  (hs &&
                    t("main_menu.high_score", {
                      score: formatFullNumber(hs) + " $",
                    })) ||
                  (getTotalScore() < u.threshold &&
                    t("unlocks.minTotalScore", {
                      score: formatFullNumber(u.threshold),
                    })) ||
                  getUpgradeHelp(u, undefined),
              };
            }),
          ],
        });
        if (choice) {
          const [action, value] = choice.split(":");
          setSettingValue("starting_perk", value);
          restart({
            runType: "normal",
            levelToAvoid: currentLevelInfo(mainGameState).name,
          });
        }
      },
    },
  ];
}
