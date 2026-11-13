import { appVersion, upgrades } from "./loadGameData";
import { t } from "./i18n/i18n";
import { GameState, RunHistoryItem } from "./types";
import {
  mainGameState,
  pause,
  restart,
  startComputerControlledGame,
} from "./game";
import { currentLevelInfo, describeLevel } from "./game_utils";
import {
  askForPersistentStorage,
  getSettingValue,
  getTotalScore,
  setSettingValue,
} from "./settings";
import { stopRecording } from "./recording";
import { asyncAlert } from "./asyncAlert";
import { closeEditorTrialRun } from "./levelEditor";
import { closeCreativeRun } from "./creative";
import { isLevelLocked } from "./get_level_unlock_condition";
import {
  applySettingsChangeReco,
  getUpgradeHelp,
  settingsChangeRecommendations,
} from "./openUpgradesPicker";
import { getIcon } from "./levelIcon";
import { closeLevelPreview } from "./openLevelDetails";
import { pickedUpgradesHTMl } from "./picked_upgrades_html";
import { allLevels } from "./allLevels";

export function addToTotalPlayTime(ms: number) {
  setSettingValue(
    "breakout_71_total_play_time",
    getSettingValue("breakout_71_total_play_time", 0) + ms,
  );
}

export async function gameOver(
  gameState: GameState,
  title: string,
  intro: string,
) {
  if (gameState.startParams.runType === "animated_perk_preview") {
    gameState.isGameOver = true;
    return;
  }
  if (["stress", "autoplay"].includes(gameState.startParams.runType)) {
    startComputerControlledGame(gameState.startParams.runType);
    return;
  }
  if (gameState.startParams.runType === "creative") {
    return closeCreativeRun(gameState);
  }
  if (gameState.startParams.runType === "level_preview_run") {
    return closeLevelPreview(gameState);
  }

  if (gameState.startParams.runType === "level_editor_trial") {
    return closeEditorTrialRun();
  }

  if (!["normal", "rogue"].includes(mainGameState.startParams.runType)) return;

  if (!mainGameState.running) return;
  // Ignore duplicated calls, can happen when ticking is split in multiple updates because the ball goes fast
  if (mainGameState.isGameOver) return;
  mainGameState.isGameOver = true;
  pause(false);
  askForPersistentStorage();
  if (!mainGameState.startParams.testMode) setSettingValue("autosave", null);
  stopRecording();

  // unlocks
  const endTs = getTotalScore();
  const startTs = endTs - mainGameState.score;
  const unlockedPerks = upgrades.filter(
    (o) => o.threshold > startTs && o.threshold < endTs,
  );
  const isRogueRun = mainGameState.startParams.runType === "rogue";
  const rogueBestRound = isRogueRun
    ? Math.max(
        mainGameState.currentLevel + 1,
        getSettingValue("rogue_best_round", 0),
      )
    : 0;
  if (isRogueRun && !mainGameState.startParams.testMode)
    setSettingValue("rogue_best_round", rogueBestRound);

  const levelStats = t("gameOver.lastLevelSummary", {
    catchRate: Math.floor(
      (mainGameState.levelCaughtCoins /
        (mainGameState.levelSpawnedCoins || 1)) *
        100,
    ),
    levelCaughtCoins: mainGameState.levelCaughtCoins,
    levelSpawnedCoins: mainGameState.levelSpawnedCoins,
    duration: Math.ceil(mainGameState.levelTime / 1000),
    levelMisses: mainGameState.levelMisses,
    level: mainGameState.currentLevel + 1,
  });

  let unlocksInfo = unlockedPerks.length
    ? `

    <h2>${unlockedPerks.length === 1 ? t("gameOver.unlocked_perk") : t("gameOver.unlocked_perk_plural", { count: unlockedPerks.length })}</h2>
    
      ${unlockedPerks
        .map(
          (u) => ` 
       <div class="upgrade used">
          ${getIcon("icon:" + u.id)}
          <p>
          <strong>${u.name}</strong>
           ${getUpgradeHelp(u, undefined)}
        </p>  
      </div>
      `,
        )
        .join("\n")}       
    `
    : "";

  // Avoid the sad sound right as we restart a new games
  mainGameState.combo = 1;

  const choice = await asyncAlert({
    id: "gameOver",
    allowClose: true,
    title,
    content: [
      levelStats,
      isRogueRun
        ? t("rogue.game_over", {
            round: mainGameState.currentLevel + 1,
            best: rogueBestRound,
          })
        : "",
      intro,
      startTs != endTs
        ? t("gameOver.total", { score: mainGameState.score }) +
          " " +
          t("gameOver.cumulative_total", { startTs, endTs })
        : "",

      settingsChangeRecommendations(),
      {
        icon: getIcon("icon:new_run"),
        value: null,
        text: t("confirmRestart.yes"),
        help: "",
      },
      `<div id="level-recording-container"></div>`,

      unlocksInfo,
      getHistograms(mainGameState),
      pickedUpgradesHTMl(mainGameState),
    ],
  });
  applySettingsChangeReco(choice);
  restart({
    // Starting over after a rogue run starts another rogue run
    runType: isRogueRun ? "rogue" : "normal",
    testMode: isRogueRun && !!mainGameState.startParams.testMode,
    levelToAvoid: currentLevelInfo(mainGameState).name,
  });
}

let runsHistory = [];

try {
  runsHistory = JSON.parse(
    localStorage.getItem("breakout_71_runs_history") || "[]",
  )
    .sort(
      (a, b) =>
        parseInt(b.appVersion) - parseInt(a.appVersion) || b.score - a.score,
    )
    .slice(0, 100) as RunHistoryItem[];
} catch (e) {}

export function getHistory() {
  return runsHistory;
}

export function addGameToHistory(gameState: GameState) {
  if (gameState.startParams.runType !== "normal") return "";
  if (!gameState.currentLevel) {
    return;
  }
  if (runsHistory.find((r) => r.started === gameState.runStatistics.started)) {
    // already saved
    return;
  }

  addToTotalPlayTime(mainGameState.runStatistics.runTime);
  if (gameState.startParams.mainPerkId) {
    setSettingValue(
      "starting_" + gameState.startParams.mainPerkId + "_hs",
      Math.max(
        gameState.score,
        getSettingValue(
          "starting_" + gameState.startParams.mainPerkId + "_hs",
          0,
        ),
      ),
    );
    setSettingValue(
      "starting_" + gameState.startParams.mainPerkId + "_max_lvl",
      Math.max(
        gameState.currentLevel + 1,
        getSettingValue(
          "starting_" + gameState.startParams.mainPerkId + "_max_lvl",
          0,
        ),
      ),
    );
  }
  setSettingValue(
    "max_lvl",
    Math.max(gameState.currentLevel + 1, getSettingValue("max_lvl", 0)),
  );
  const perks: Partial<GameState["perks"]> = { ...gameState.perks };
  for (let id in perks) {
    if (!perks[id]) {
      delete perks[id];
    }
  }
  runsHistory.push({
    ...gameState.runStatistics,
    perks,
    appVersion,
    mainPerkId: gameState.startParams.mainPerkId,
  });
  localStorage.setItem(
    "breakout_71_runs_history",
    JSON.stringify(runsHistory, null, 2),
  );
}

export function getHistograms(gameState: GameState) {
  if (gameState.startParams.runType !== "normal") return "";
  let unlockedLevels = "";
  let runStats = "";
  try {
    gameState.runStatistics.runTime = Math.round(
      gameState.runStatistics.runTime,
    );
    const locked = allLevels.filter((l) => isLevelLocked(l, runsHistory));
    addGameToHistory(gameState);
    const unlocked = locked.filter((l) => !isLevelLocked(l, runsHistory));

    if (unlocked.length) {
      unlockedLevels = `

      <h2>${unlocked.length === 1 ? t("unlocks.just_unlocked") : t("unlocks.just_unlocked_plural", { count: unlocked.length })}</h2>
      
        ${unlocked
          .map(
            (l) => ` 
         <div class="upgrade used">
            ${getIcon(l.name)}
            <p>
            <strong>${l.name}</strong>
          ${describeLevel(l)}
          </p>  
        </div>
        `,
          )
          .join("\n")}       
      `;
    }

    // Generate some histogram

    const makeHistogram = (
      title: string,
      getter: (hi: RunHistoryItem) => number,
      unit: string,
    ) => {
      let values = runsHistory.map((h) => getter(h) || 0);
      let min = Math.min(...values);
      let max = Math.max(...values);
      // No point
      if (min === max) return "";
      if (max - min < 10) {
        // This is mostly useful for levels
        min = Math.max(0, max - 10);
        max = Math.max(max, min + 10);
      }
      // One bin per unique value, max 10
      const binsCount = Math.min(values.length, 10);
      if (binsCount < 3) return "";
      const bins = [] as number[];
      const binsValues = [] as number[][];
      let useLogScale = max - min > 100;
      for (let i = 0; i < binsCount; i++) {
        bins.push(0);
        binsValues.push([]);
      }

      const binIndexOf = (v: number) => {
        const delta = useLogScale ? Math.log(v - min) : v - min;
        const binSize =
          (useLogScale ? Math.log(max - min) : max - min) / binsCount;
        return Math.max(
          0,
          Math.min(bins.length - 1, Math.floor(delta / binSize)),
        );
      };
      values.forEach((v) => {
        if (isNaN(v)) return;
        const index = binIndexOf(v);
        bins[index]++;
        binsValues[index].push(v);
      });
      if (bins.filter((b) => b).length < 3) return "";
      const maxBin = Math.max(...bins);
      const lastValue = values[values.length - 1];
      const activeBin = binIndexOf(lastValue);

      const bars = bins
        .map((v, vi) => {
          const style = `height: ${(v / maxBin) * 80}px`;
          const min = Math.min(...binsValues[vi]);
          const max = Math.max(...binsValues[vi]);
          const between =
            min !== max ? `between ${min} and ${max}` : `at ${min}`;
          const title = `${v} run${v > 1 ? "s" : ""} ${between} ${unit}`;
          return `<span class="${vi === activeBin ? "active" : ""}"><span style="${style}" title="${title}"
              ><span>${(!v && " ") || (vi == activeBin && lastValue + unit) || Math.round(binsValues[vi].reduce((a, b) => a + b, 0) / v) + unit}</span></span></span>`;
        })
        .join("");

      return `<h2 class="histogram-title">${title}: <strong>${lastValue}${unit}</strong></h2>
            <div class="histogram">${bars}</div>
            `;
    };

    runStats += makeHistogram(
      t("gameOver.stats.total_score"),
      (r) => r.score,
      "",
    );
    runStats += makeHistogram(
      t("gameOver.stats.catch_rate"),
      (r) => Math.round((r.score / r.coins_spawned) * 100),
      "%",
    );
    runStats += makeHistogram(
      t("gameOver.stats.bricks_broken"),
      (r) => r.bricks_broken,
      "",
    );
    runStats += makeHistogram(
      t("gameOver.stats.bricks_per_minute"),
      (r) => Math.round((r.bricks_broken / r.runTime) * 1000 * 60),
      "",
    );
    runStats += makeHistogram(
      t("gameOver.stats.hit_rate"),
      (r) => Math.round((1 - r.misses / r.puck_bounces) * 100),
      "%",
    );
    runStats += makeHistogram(
      t("gameOver.stats.duration_per_level"),
      (r) => Math.round(r.runTime / 1000 / r.levelsPlayed),
      "s",
    );
    runStats += makeHistogram(
      t("gameOver.stats.level_reached"),
      (r) => r.levelsPlayed,
      "",
    );
    runStats += makeHistogram(
      t("gameOver.stats.upgrades_applied"),
      (r) => r.upgrades_picked,
      "",
    );
    runStats += makeHistogram(
      t("gameOver.stats.balls_lost"),
      (r) => r.balls_lost,
      "",
    );
    runStats += makeHistogram(
      t("gameOver.stats.combo_avg"),
      (r) => Math.round(r.coins_spawned / r.bricks_broken),
      "",
    );
    runStats += makeHistogram(
      t("gameOver.stats.combo_max"),
      (r) => r.max_combo,
      "",
    );

    if (runStats) {
      runStats =
        `<p>${t("gameOver.stats_intro", { count: runsHistory.length - 1 })}</p>` +
        runStats;
    }
  } catch (e) {
    console.warn(e);
  }
  return unlockedLevels + runStats;
}
