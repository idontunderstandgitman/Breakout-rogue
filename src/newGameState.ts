import { GameState, PerkId, RunParams } from "./types";
import { allLevelsAndIcons, appVersion, upgrades } from "./loadGameData";
import { defaultSounds, getHighScore, makeEmptyPerksMap } from "./game_utils";
import { resetBalls } from "./gameStateMutators";
import { getHistory } from "./gameOver";
import { getSettingValue } from "./settings";
import { getStartingPerks } from "./startingPerks";
import { isLevelLocked } from "./get_level_unlock_condition";
import {
  dontOfferTooSoon,
  logUpgradePicked,
  logUpgradeShown,
} from "./openUpgradesPicker";
import { allLevels } from "./allLevels";
import { getUnlockedLevelList } from "./unlocked_level_list";
import {
  ROGUE_EXCLUDED_PERKS,
  ROGUE_TEST_WALLET,
  emptyCurses,
  ROGUE_SLOW_PADDLE_MAX_STAGE,
  newRogueSeed,
} from "./rogue_generator";

export function getRunLevels(
  params: RunParams,
  randomGift: PerkId | undefined,
) {
  const unlockedBefore = getUnlockedLevelList();

  const history = getHistory();
  const unlocked = allLevels
    .filter((l, li) => unlockedBefore.has(l.name) || !isLevelLocked(l, history))
    .filter((l) => getSettingValue("offer-level-" + l.name, true));
  const firstLevel = params?.level
    ? [params.level]
    : allLevelsAndIcons.filter((l) => l.name == "icon:" + randomGift);

  const restInRandomOrder = unlocked
    .filter((l) => l.name !== params?.level?.name)
    .filter((l) => l.name !== params?.levelToAvoid)
    .sort(() => Math.random() - 0.5);

  return firstLevel
    .concat(
      restInRandomOrder.slice(0, 7 + 3).sort((a, b) => a.sortKey - b.sortKey),
    )
    .concat(restInRandomOrder.slice(7 + 3));
}

export function newGameState(params: RunParams): GameState {
  const isRogueRun = params.runType === "rogue";
  const highScore = isRogueRun
    ? getSettingValue<number>("rogue_hs", 0)
    : parseFloat(getHighScore().toString());

  // Rogue runs use the same starting perk as campaign runs
  if (["normal", "rogue"].includes(params.runType)) {
    // Perks that end the run or stop upgrades can't be a rogue starting perk
    const randomPick = getStartingPerks(isRogueRun ? ROGUE_EXCLUDED_PERKS : []);

    params.perks ||= randomPick.perks;
    params.mainPerkId ||= randomPick.mainPerkId;
  }

  const perks = {
    ...makeEmptyPerksMap(upgrades),
    ...(params?.perks || {}),
  };

  if (["normal", "rogue"].includes(params.runType))
    Object.keys(perks)
      .filter((id) => perks[id as PerkId])
      .forEach((id) => {
        logUpgradeShown(id as PerkId);
        logUpgradePicked(id as PerkId);
      });

  // Rogue maps are built one by one when each round starts
  const runLevels = isRogueRun ? [] : getRunLevels(params, params.mainPerkId);
  const gameState: GameState = {
    startParams: params,
    runLevels,
    // Replaced by the first generated map as soon as the run starts
    level: runLevels[0] ?? allLevelsAndIcons[0],
    currentLevel: 0,
    upgradesOfferedFor: -1,
    perks,
    puckWidth: 200,
    baseSpeed: 12,
    combo: 1,
    lastCombo: 1,
    gridSize: 12,
    running: false,
    isGameOver: false,
    ballStickToPuck: true,
    puckPosition: 400,
    lastPuckPosition: 400,
    lastPuckMove: 0,
    levelLostCoins: 0,
    startCountDown: 0,
    lastZenComboIncrease: 0,
    pauseTimeout: null,
    canvasWidth: 0,
    canvasHeight: 0,
    offsetX: 0,
    offsetXRoundedDown: 0,
    gameZoneWidth: 0,
    gameZoneWidthRoundedUp: 0,
    gameZoneHeight: 0,
    brickWidth: 0,
    score: 0,
    lastScoreIncrease: -1000,
    levelCaughtCoins: 0,
    levelBrickBroken: 0,
    lastExplosion: -1000,
    lastBrickBroken: 0,
    highScore,
    balls: [],
    ballsColor: "#FFFFFF",
    bricks: [],
    brickHP: [],
    lights: { indexMin: 0, total: 0, list: [] },
    particles: { indexMin: 0, total: 0, list: [] },
    texts: { indexMin: 0, total: 0, list: [] },
    coins: { indexMin: 0, total: 0, list: [] },
    respawns: { indexMin: 0, total: 0, list: [] },
    delayedDmgs: { indexMin: 0, total: 0, list: [] },
    levelStartScore: 0,
    levelMisses: 0,
    levelSpawnedCoins: 0,
    puckColor: "#FFFFFF",
    ballSize: 20 * (1 + perks.bigger_balls),
    coinSize: 14,
    puckHeight: 20,
    pauseUsesDuringRun: 0,
    keyboardPuckSpeed: 0,
    lastTick: performance.now(),
    lastTickDown: 0,
    runStatistics: {
      started: Date.now(),
      levelsPlayed: 0,
      runTime: 0,
      coins_spawned: 0,
      score: 0,
      bricks_broken: 0,
      misses: 0,
      balls_lost: 0,
      puck_bounces: 0,
      wall_bounces: 0,
      upgrades_picked: 1,
      max_combo: 1,
    },
    offersCount: {},
    levelTime: 0,
    winAt: 0,
    bossBroken: [],
    bossExpired: false,
    levelWallBounces: 0,
    needsRender: true,
    autoCleanUses: 0,
    ...defaultSounds(),
    rerolls: 0,
    bedrock: [],
    rogueWallet: params.testMode ? ROGUE_TEST_WALLET : 0,
    rogueHeadStart: 0,
    rogueBedrockShield: 0,
    rogueExtraUpgradeChoices: 0,
    rogueExtraShopOptions: 0,
    rogueSavedPicks: 0,
    rogueOwnedBias: false,
    rogueCurses: emptyCurses(),
    rogueSlowStage: ROGUE_SLOW_PADDLE_MAX_STAGE,
    rogueLivesBought: 0,
    puckTarget: 0,
    retroDirection: 0,
    rogueSeed: newRogueSeed(),
    gameVersion: appVersion,
  };

  resetBalls(gameState);

  for (let perk of upgrades) {
    if (perks[perk.id]) {
      dontOfferTooSoon(gameState, perk.id);
    }
  }
  return gameState;
}
