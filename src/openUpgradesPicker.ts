import { GameState, PerkId, Upgrade } from "./types";
import {
  catchRateBest,
  catchRateGood,
  choicePerGold,
  choicePerSilver,
  levelTimeBest,
  levelTimeGood,
  missesBest,
  missesGood,
  upPerGold,
  upPerSilver,
} from "./pure_functions";
import { t } from "./i18n/i18n";
import { requiredAsyncAlert } from "./asyncAlert";
import {
  escapeAttribute,
  getPossibleUpgrades,
  levelsListHTMl,
  renderMaxLevel,
  upgradeLevelAndMaxDisplay,
} from "./game_utils";
import { getFirstUnlockable, getNearestUnlockHTML } from "./openScorePanel";
import { isOptionOn } from "./options";
import { isPerformanceTerrible } from "./fps";
import { getSettingValue, setSettingValue } from "./settings";
import { toast } from "./toast";
import { getIcon } from "./levelIcon";
import { pickedUpgradesHTMl } from "./picked_upgrades_html";
import { synergies } from "./synergies";
import { incompatibilities } from "./incompatibilities";
import {
  isRogue,
  isRogueTest,
  pickOffers,
  rerollPrice,
  rogueUpgradePicks,
} from "./rogue_generator";

export async function openUpgradesPicker(gameState: GameState) {
  if (gameState.perks.chill) return;
  const catchRate =
    gameState.levelCaughtCoins / (gameState.levelSpawnedCoins || 1);

  let medals = [];
  let upgradePoints = 1;
  let extraChoices = 0;
  let ownedBias = false;

  let hasMedals = 0;

  function challengeResult(
    name: String,
    description: String,
    medal: "gold" | "silver" | "no",
  ) {
    let choices = 0,
      up = 0;
    if (medal === "gold") {
      choices += choicePerGold;
      up += upPerGold;
    } else if (medal === "silver") {
      choices += choicePerSilver;
      up += upPerSilver;
    }
    if (medal !== "no") {
      hasMedals++;
    }

    extraChoices += choices;
    upgradePoints += up;
    medals.push(`<div  class="upgrade" data-tooltip="${escapeAttribute(description)}">
                        ${getIcon("icon:" + medal + "_medal")}
                        <p>
                        <strong>${name}</strong><br/>
                        ${
                          up || choices
                            ? t("level_up.challenges.gain", { up, choices })
                            : t("level_up.challenges.no_gain")
                        }
                      
                        </p> 
                    </div>`);
  }

  challengeResult(
    t("level_up.challenges.levelTime.name", {
      value: Math.ceil(gameState.levelTime / 1000),
    }),
    t("level_up.challenges.levelTime.description", {
      silver: levelTimeGood,
      gold: levelTimeBest,
    }),
    (gameState.levelTime < levelTimeBest * 1000 && "gold") ||
      (gameState.levelTime < levelTimeGood * 1000 && "silver") ||
      "no",
  );

  challengeResult(
    t("level_up.challenges.catchRateGood.name", {
      value: Math.floor(catchRate * 100),
      caught: gameState.levelCaughtCoins,
      total: gameState.levelSpawnedCoins,
    }),
    t("level_up.challenges.catchRateGood.description", {
      silver: catchRateGood,
      gold: catchRateBest,
    }),
    (catchRate > catchRateBest / 100 && "gold") ||
      (catchRate > catchRateGood / 100 && "silver") ||
      "no",
  );

  const misses = Math.max(0, gameState.levelMisses - gameState.perks.forgiving);

  challengeResult(
    misses
      ? t("level_up.challenges.levelMisses.name", {
          value: misses,
        })
      : t("level_up.challenges.levelMisses.none"),
    t("level_up.challenges.levelMisses.description", {
      silver: missesGood,
      gold: missesBest,
    }),
    (misses < missesBest && "gold") ||
      (misses < missesGood && "silver") ||
      "no",
  );

  if (hasMedals == 0) {
    medals.length = 0;
  } else if (hasMedals == 1) {
    medals.unshift(t("level_up.challenges.earned_medal", { count: hasMedals }));
  } else {
    medals.unshift(
      t("level_up.challenges.earned_medal_plural", { count: hasMedals }),
    );
  }

  if (isRogue(gameState)) {
    // Rogue mode has no medals : picks depend on missed shots only, choices stay the same
    medals.length = 0;
    extraChoices = gameState.rogueExtraUpgradeChoices;
    gameState.rogueExtraUpgradeChoices = 0;
    const saved = gameState.rogueSavedPicks || 0;
    gameState.rogueSavedPicks = 0;
    upgradePoints = rogueUpgradePicks(misses) + saved;
    medals.push(
      t("rogue.picks_summary", {
        misses,
        count: rogueUpgradePicks(misses),
      }),
    );
    if (saved) medals.push(t("rogue.picks_saved_used", { count: saved }));
    ownedBias = !!gameState.rogueOwnedBias;
    gameState.rogueOwnedBias = false;
    if (isRogueTest(gameState)) {
      // Test run : every upgrade is on offer, as many picks as you want
      extraChoices = 1000;
      upgradePoints = 1000;
      ownedBias = false;
    }
  }

  const scored = getPossibleUpgrades(gameState).map((u) => {
    let requiredPerksCount = 0;
    for (let required in u.requires) {
      if (
        gameState.perks[required as PerkId] &&
        !gameState.perks[u.id] &&
        u.id !== required
      ) {
        requiredPerksCount++;
      }
    }

    let synergy = 0;
    for (let required in synergies) {
      if (
        gameState.perks[required as PerkId] &&
        synergies[required as PerkId]?.includes(u.id) &&
        !gameState.perks[u.id]
      ) {
        synergy++;
      }
    }
    // avoid offering perks that aren't very compatible
    let incompatibility = 0;
    incompatibilities.forEach((perks) => {
      // if u is in the incompatibilities
      if (!perks.includes(u.id)) return;
      // and u is not picked already
      if (gameState.perks[u.id]) return;
      // reduce chances for each pther perk found
      perks.forEach((p) => {
        if (gameState.perks[p] && p !== u.id) {
          incompatibility++;
        }
      });
    });

    // Add lvl chances to see a perk if already picked
    const againPlease = gameState.perks[u.id] || 0;

    // Reduce the score if recently offered
    const score =
      (1 + synergy + againPlease + requiredPerksCount) /
      (1 + (gameState.offersCount[u.id] || 0) + incompatibility);

    return {
      ...u,
      score,
    };
  });

  const rollOffers = () =>
    scored
      .map((u) => ({ ...u, score: u.score * Math.random() }))
      .sort((a, b) => b.score - a.score)
      .filter(
        (u) =>
          gameState.perks[u.id] <
          Math.min(u.max + gameState.perks.limitless, u.hardLimit),
      );
  let sorted = rollOffers();
  // Rogue : paying coins draws new offers, the price doubles each time
  let rerolls = 0;

  let recommendation = settingsChangeRecommendations();

  let usedCountCache: Record<string, number> = {};
  const usageRate = (u: Upgrade) => {
    if (!(u.id in usedCountCache)) {
      usedCountCache[u.id] =
        getUpgradesPicked(u.id) / (1 + getUpgradesShown(u.id));
    }
    return usedCountCache[u.id];
  };
  while (!gameState.perks.chill) {
    // refresh the list if you pick extra one_more_choice
    const offered = pickOffers(
      sorted,
      3 + extraChoices + gameState.perks.one_more_choice,
      (u) => gameState.perks[u.id] > 0,
      ownedBias,
    );
    if (!isRogueTest(gameState))
      offered.forEach((u) => {
        dontOfferTooSoon(gameState, u.id);
      });

    const unlockable = getFirstUnlockable(gameState);
    let unlockRelatedUpgradesOffered = 0;

    const upgradesActions = offered
      .sort((a, b) => {
        return usageRate(b) - usageRate(a);
      })
      .map((u) => {
        let unlockHint = "";
        let className = "";
        if (isOptionOn("level_unlocks_hints")) {
          if (unlockable?.forbidden?.includes(u.id) && !gameState.perks[u.id]) {
            unlockRelatedUpgradesOffered++;
            className += " forbidden";
            unlockHint = t("level_up.forbidden", {
              levelName: unlockable?.l.name || "",
            });
          }
          if (unlockable?.required?.includes(u.id) && !gameState.perks[u.id]) {
            unlockRelatedUpgradesOffered++;
            className += " required";
            unlockHint = t("level_up.required", {
              levelName: unlockable?.l.name || "",
            });
          }
        }
        const disabled =
          gameState.perks[u.id] >= u.max + gameState.perks.limitless;
        if (!disabled && !isRogueTest(gameState)) {
          logUpgradeShown(u.id);
        }
        return {
          value: u.id,
          disabled,
          text:
            u.name +
            (gameState.perks[u.id]
              ? upgradeLevelAndMaxDisplay(u, gameState)
              : ""),
          icon: getIcon("icon:" + u.id),

          help: getUpgradeHelp(u, gameState),
          tooltip: unlockHint + getUpgradeTooltip(u, gameState),
          className,
          actionLabel: t(
            gameState.perks[u.id] ? "level_up.upgrade" : "level_up.pick",
          ),
        };
      });

    const choice = await requiredAsyncAlert<
      PerkId | { changeSettings: Record<string, any> }
    >({
      id: "level_up",
      title: t("level_up.title", {
        level: gameState.currentLevel,
        max: renderMaxLevel(gameState),
      }),
      content: [
        t("level_up.upgrade_perks", {
          coins: gameState.levelCaughtCoins,
          count: upgradePoints,
        }),
        ...upgradesActions,
        // Rogue only : new offers for coins
        // Rogue only. Cast because the picker's choice type only lists upgrades.
        (isRogue(gameState) && !isRogueTest(gameState)
          ? {
              value: "rogue:reroll",
              icon: getIcon("icon:reroll"),
              text: t("rogue.picker.reroll"),
              help: t("rogue.picker.reroll_help", {
                price: rerollPrice(gameState.level.bricksCount, rerolls),
              }),
              disabled:
                gameState.rogueWallet <
                rerollPrice(gameState.level.bricksCount, rerolls),
            }
          : "") as any,
        // Rogue only : skip the rest of the picks and keep them for next round.
        // Cast because the picker's choice type only lists upgrades.
        (isRogue(gameState)
          ? {
              value: "rogue:save",
              icon: getIcon("icon:new_run"),
              text: isRogueTest(gameState)
                ? t("rogue.picker.done")
                : t("rogue.picker.save", { count: upgradePoints }),
              help: isRogueTest(gameState)
                ? t("rogue.picker.done_help")
                : t("rogue.picker.save_help"),
            }
          : "") as any,
        levelsListHTMl(gameState, gameState.currentLevel),
        // Close to upgrades if particularly relevant
        unlockRelatedUpgradesOffered ? getNearestUnlockHTML(gameState) : "",
        recommendation,
        ...medals,
        pickedUpgradesHTMl(gameState),
        // Otherwise, at the bottom
        unlockRelatedUpgradesOffered ? "" : getNearestUnlockHTML(gameState),
        `<div id="level-recording-container"></div>`,
      ],
    });

    if ((choice as unknown) === "rogue:reroll") {
      const price = rerollPrice(gameState.level.bricksCount, rerolls);
      if (gameState.rogueWallet >= price) {
        gameState.rogueWallet -= price;
        rerolls++;
        sorted = rollOffers();
      }
      continue;
    }
    if ((choice as unknown) === "rogue:save") {
      // Skip the remaining picks, they are added to the next round's picks
      if (!isRogueTest(gameState))
        gameState.rogueSavedPicks =
          (gameState.rogueSavedPicks || 0) + upgradePoints;
      return;
    }
    if (applySettingsChangeReco(choice)) {
      recommendation = "";
    } else {
      if (!isRogueTest(gameState)) logUpgradePicked(choice as PerkId);
      upgradePoints--;
      gameState.perks[choice as PerkId]++;
      gameState.runStatistics.upgrades_picked++;
      if (!upgradePoints) {
        return;
      }
    }
  }
}

export function dontOfferTooSoon(gameState: GameState, id: PerkId) {
  gameState.offersCount[id] ||= 0;
  gameState.offersCount[id]++;
}

export function applySettingsChangeReco(choice: unknown) {
  if (!choice) return;
  if (typeof choice == "object" && "changeSettings" in choice) {
    const changes = choice.changeSettings as Record<string, any>;
    for (let key in changes) {
      setSettingValue(key, changes[key]);
    }
    toast(t("settings.suggestions.applied"));
    return true;
  }
  return false;
}

export function settingsChangeRecommendations() {
  if (!isPerformanceTerrible()) return "";

  if (isOptionOn("record"))
    return {
      icon: getIcon("icon:slow"),
      text: t("settings.suggestions.record"),
      value: {
        changeSettings: { "breakout-settings-enable-record": false },
      },
    };

  if (!isOptionOn("basic"))
    return {
      icon: getIcon("icon:slow"),
      text: t("settings.suggestions.basic_mode"),
      value: {
        changeSettings: { "breakout-settings-enable-basic": true },
      },
    };
}

function getUpgradesPicked(id: PerkId) {
  return getSettingValue("picked_" + id, 0);
}
function getUpgradesShown(id: PerkId) {
  return getSettingValue("showed_" + id, 0);
}

export function logUpgradeShown(id: PerkId) {
  return setSettingValue(
    "showed_" + id,
    getSettingValue("showed_" + id, 0) + 1,
  );
}
export function logUpgradePicked(id: PerkId) {
  return setSettingValue(
    "picked_" + id,
    getSettingValue("picked_" + id, 0) + 1,
  );
}

export function getUpgradeHelp(u: Upgrade, gameState: GameState | undefined) {
  return censorUpgradeInfo(u, 1, u.help(gameState?.perks[u.id] || 1));
}
export function getUpgradeTooltip(
  u: Upgrade,
  gameState: GameState | undefined,
) {
  return censorUpgradeInfo(u, 2, u.fullHelp(gameState?.perks[u.id] || 1));
}

const censorChars = "☰☱☲☳☴☵☶☷ ".split("");
function censorUpgradeInfo(
  { id, threshold }: Upgrade,
  showAfterNPicks: number,
  text: string,
) {
  if (!isOptionOn("censor_perks_before_use")) return text;
  if (threshold && getUpgradesPicked(id) < showAfterNPicks) {
    return text
      .split("")
      .map((char, i) => {
        if (!char.trim()) return char;
        return censorChars[i % censorChars.length];
      })
      .join("");
  }
  return text;
}
