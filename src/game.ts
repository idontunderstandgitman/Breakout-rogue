import { appVersion, upgrades } from "./loadGameData";
import {
  Ball,
  Coin,
  GameState,
  LightFlash,
  OptionId,
  ParticleFlash,
  PerksMap,
  RunParams,
  RunType,
  TextFlash,
} from "./types";
import { getAudioContext, playPendingSounds } from "./sounds";
import { currentLevelInfo, hoursSpentPlaying, sample } from "./game_utils";

import "./PWA/sw_loader";
import {
  currentLanguageSupportsHeavyFontWeight,
  getCurrentLang,
  languages,
  t,
} from "./i18n/i18n";
import {
  commitSettingsChangesToLocalStorage,
  cycleMaxCoins,
  getCurrentMaxCoins,
  getSettingValue,
  setSettingValue,
} from "./settings";
import {
  applyPuckCurses,
  gameStateTick,
  loadLevelBackground,
  normalizeGameState,
  setLevel,
  setMousePos,
} from "./gameStateMutators";
import {
  backgroundCanvas,
  gameCanvas,
  getHaloScale,
  haloCanvas,
  render,
  scoreDisplay,
} from "./render";
import {
  pauseRecording,
  recordOneFrame,
  resumeRecording,
  startRecordingGame,
} from "./recording";
import { newGameState } from "./newGameState";
import {
  alertsOpen,
  asyncAlert,
  AsyncAlertAction,
  closeModal,
} from "./asyncAlert";
import { isOptionOn, options, toggleOption } from "./options";
import { clamp, forEachLiveOne, isComputerControlled } from "./pure_functions";
import { helpMenuEntry } from "./help";
import { creativeMode } from "./creative";
import { hideAnyTooltip, setupTooltips } from "./tooltip";
import "./migrations";
import { generateSaveFileContent } from "./generateSaveFileContent";
import { runHistoryViewerMenuEntry } from "./runHistoryViewer";
import { openScorePanel } from "./openScorePanel";
import { monitorLevelsUnlocks } from "./monitorLevelsUnlocks";
import { levelEditorMenuEntry } from "./levelEditor";
import { frameStarted, isPerformanceTerrible, startWork } from "./fps";
import { openUnlockedUpgradesList } from "./openUnlockedUpgradesList";
import { getCheckboxIcon, getIcon } from "./levelIcon";
import { menuClick } from "./menuSound";
import { toast } from "./toast";
import { addGameToHistory } from "./gameOver";
import { getStartRunButtons } from "./startingPerks";
import { allLevels } from "./allLevels";
import { openUnlockedLevelsList } from "./openUnlockedLevelsList";

export async function play() {
  if (await applyFullScreenChoice()) return;
  if (mainGameState.running) return;
  mainGameState.running = true;
  mainGameState.ballStickToPuck = false;

  menuClick();
  startRecordingGame(mainGameState);
  getAudioContext()?.resume();
  resumeRecording();
  hideAnyTooltip();
  // document.body.classList[gameState.running ? 'add' : 'remove']('running')
}

export function pause(playerAskedForPause: boolean) {
  if (!mainGameState.running) return;

  if (mainGameState.pauseTimeout && playerAskedForPause) {
    return;
  }
  if (isComputerControlled(mainGameState)) {
    play();
    return;
  }
  const stop = () => {
    mainGameState.running = false;

    setTimeout(() => {
      if (!mainGameState.running) getAudioContext()?.suspend();
    }, 1000);

    pauseRecording();
    if (mainGameState.pauseTimeout) {
      // In case an instant pause was requested while a delayed pause was pending
      clearTimeout(mainGameState.pauseTimeout);
      mainGameState.pauseTimeout = null;
    }
    mainGameState.needsRender = true;
  };

  if (playerAskedForPause) {
    menuClick();
    // Pausing many times in a run will make pause slower
    mainGameState.pauseUsesDuringRun++;
    mainGameState.pauseTimeout = setTimeout(
      stop,
      Math.min(Math.max(0, mainGameState.pauseUsesDuringRun - 5) * 50, 500),
    );
  } else {
    stop();
  }

  if (document.exitPointerLock) {
    document.exitPointerLock();
  }
  hideAnyTooltip();
}

export const fitSize = (gameState: GameState) => {
  if (!gameState) throw new Error("Missign game state");
  if (gameState.startParams.runType === "animated_perk_preview") return;
  const past_off = gameState.offsetXRoundedDown,
    past_width = gameState.gameZoneWidthRoundedUp,
    past_heigh = gameState.gameZoneHeight;

  const width = Math.floor(window.innerWidth),
    height = Math.floor(
      window.innerHeight - (isOptionOn("notch_space") ? 40 : 0),
    );

  gameState.canvasWidth = width;
  gameState.canvasHeight = height;
  gameCanvas.width = width;
  gameCanvas.height = height;
  backgroundCanvas.width = width;
  backgroundCanvas.height = height;
  const haloScale = getHaloScale();
  haloCanvas.width = width / haloScale;
  haloCanvas.height = height / haloScale;

  gameState.gameZoneHeight = isOptionOn("mobile-mode")
    ? Math.floor(height * 0.8)
    : height;

  const baseWidth = Math.round(
    Math.min(
      gameState.canvasWidth,
      (gameState.gameZoneHeight *
        0.73 *
        (gameState.gridSize + gameState.perks.unbounded * 2)) /
        gameState.gridSize,
    ),
  );

  if (gameState.gameZoneHeight > baseWidth * 2) {
    gameState.gameZoneHeight = baseWidth * 2;
  }

  forEachLiveOne(gameState.coins, (b) => (b.size = gameState.coinSize));

  gameState.brickWidth =
    Math.floor(
      baseWidth / (gameState.gridSize + gameState.perks.unbounded * 2) / 2,
    ) * 2;

  gameState.gameZoneWidth = gameState.brickWidth * gameState.gridSize;
  gameState.offsetX = Math.floor(
    (gameState.canvasWidth - gameState.gameZoneWidth) / 2,
  );
  // Space between left side and border
  gameState.offsetXRoundedDown =
    gameState.offsetX - gameState.perks.unbounded * gameState.brickWidth;
  if (
    gameState.offsetX <
    gameState.ballSize + gameState.perks.unbounded * 2 * gameState.brickWidth
  )
    gameState.offsetXRoundedDown = 0;
  gameState.gameZoneWidthRoundedUp = width - 2 * gameState.offsetXRoundedDown;
  backgroundCanvas.title = "resized";
  // Ensure puck stays within bounds
  setMousePos(gameState, gameState.puckPosition);

  function mapXY(item: ParticleFlash | TextFlash | LightFlash) {
    item.x =
      gameState.offsetXRoundedDown +
      ((item.x - past_off) / past_width) * gameState.gameZoneWidthRoundedUp;
    item.y = (item.y / past_heigh) * gameState.gameZoneHeight;
  }

  function mapXYPastCoord(coin: Coin | Ball) {
    coin.x =
      gameState.offsetXRoundedDown +
      ((coin.x - past_off) / past_width) * gameState.gameZoneWidthRoundedUp;
    coin.y = (coin.y / past_heigh) * gameState.gameZoneHeight;
    coin.previousX = coin.x;
    coin.previousY = coin.y;
  }

  gameState.balls.forEach(mapXYPastCoord);
  forEachLiveOne(gameState.coins, mapXYPastCoord);
  forEachLiveOne(gameState.particles, mapXY);
  forEachLiveOne(gameState.texts, mapXY);
  forEachLiveOne(gameState.lights, mapXY);
  pause(true);
  // For safari mobile https://css-tricks.com/the-trick-to-viewport-units-on-mobile/
  document.documentElement.style.setProperty(
    "--vh",
    `${window.innerHeight * 0.01}px`,
  );
};
window.addEventListener("resize", () => fitSize(mainGameState));
window.addEventListener("fullscreenchange", () => fitSize(mainGameState));

setInterval(() => {
  // Sometimes, the page changes size without triggering the event (when switching to fullscreen, closing debug panel...)

  const width = Math.floor(window.innerWidth),
    height = Math.floor(window.innerHeight);

  if (
    width !== mainGameState.canvasWidth ||
    (!isOptionOn("notch_space") && height !== mainGameState.canvasHeight)
  )
    fitSize(mainGameState);
}, 1000);

gameCanvas.addEventListener("mouseup", (e) => {
  if (e.button !== 0) return;
  if (mainGameState.running) {
    pause(true);
  } else {
    play();
    if (isOptionOn("pointerLock") && gameCanvas.requestPointerLock) {
      gameCanvas.requestPointerLock()?.then();
    }
  }
});

gameCanvas.addEventListener("mousemove", (e) => {
  if (document.pointerLockElement === gameCanvas) {
    setMousePos(mainGameState, mainGameState.puckPosition + e.movementX);
  } else {
    setMousePos(mainGameState, e.clientX);
  }
});

let timers: NodeJS.Timeout[] = [];
function startPlayCountDown() {
  stopPlayCountDown();

  mainGameState.startCountDown = 3;
  mainGameState.needsRender = true;

  timers.push(
    setTimeout(() => {
      mainGameState.startCountDown = 2;
      mainGameState.needsRender = true;
    }, 1000),
  );
  timers.push(
    setTimeout(() => {
      mainGameState.startCountDown = 1;
      mainGameState.needsRender = true;
    }, 2000),
  );
  timers.push(
    setTimeout(() => {
      mainGameState.startCountDown = 0;
      play();
    }, 3000),
  );
}
function stopPlayCountDown() {
  if (!timers.length) return;

  mainGameState.startCountDown = 0;
  timers.forEach((id) => clearTimeout(id));
  timers.length = 0;
}
/**
 * Rogue retro curse : the touch screen is two buttons, left half and right half.
 * The paddle goes the way of the last finger that is down, and stops when none is.
 * Returns false when the curse is not active, the normal touch controls then apply.
 */
function retroTouch(touches: TouchList) {
  if (!(mainGameState.rogueCurses?.retro > 0)) return false;
  const last = touches[touches.length - 1];
  mainGameState.retroDirection = last
    ? last.pageX < mainGameState.canvasWidth / 2
      ? -1
      : 1
    : 0;
  return true;
}
gameCanvas.addEventListener("touchstart", (e) => {
  e.preventDefault();
  if (!e.touches?.length) return;
  if (retroTouch(e.touches)) {
    // Buttons, not "hold to play" : the round starts on the first press, no countdown
    stopPlayCountDown();
    play();
    return;
  }
  setMousePos(mainGameState, e.touches[0].pageX);
  normalizeGameState(mainGameState);
  if (mainGameState.levelTime || !isOptionOn("touch_delayed_start")) {
    play();
  } else {
    //   start play sequence
    startPlayCountDown();
  }
});
function touchEnded(e: TouchEvent) {
  e.preventDefault();
  mainGameState.retroDirection = 0;
  if (retroTouch(e.touches)) {
    // Releasing a button only stops the paddle, the game keeps running
    return;
  }
  stopPlayCountDown();
  pause(true);
}
gameCanvas.addEventListener("touchend", touchEnded);
gameCanvas.addEventListener("touchcancel", touchEnded);
gameCanvas.addEventListener("touchmove", (e) => {
  if (!e.touches?.length) return;
  if (retroTouch(e.touches)) return;
  setMousePos(mainGameState, e.touches[0].pageX);
});

const ctx = gameCanvas.getContext("2d", {
  alpha: false,
}) as CanvasRenderingContext2D;

export function tick() {
  frameStarted();
  startWork("physics");
  const currentTick = performance.now();
  const timeDeltaMs = currentTick - mainGameState.lastTick;
  mainGameState.lastTick = currentTick;

  let frames = Math.min(4, timeDeltaMs / (1000 / 60));
  if (mainGameState.keyboardPuckSpeed) {
    setMousePos(
      mainGameState,
      mainGameState.puckPosition + mainGameState.keyboardPuckSpeed,
    );
  }
  if (mainGameState.perks.superhot) {
    frames *= clamp(
      Math.abs(mainGameState.puckPosition - mainGameState.lastPuckPosition) / 5,
      0.2 / mainGameState.perks.superhot,
      1,
    );
  }

  applyPuckCurses(mainGameState, frames);
  normalizeGameState(mainGameState);
  if (mainGameState.running) {
    mainGameState.levelTime += timeDeltaMs * frames;
    mainGameState.runStatistics.runTime += timeDeltaMs * frames;
    let maxSpeed2 = 0;
    mainGameState.balls.forEach(
      ({ vx, vy }) => (maxSpeed2 = Math.max(maxSpeed2, vx * vx + vy * vy)),
    );
    forEachLiveOne(
      mainGameState.coins,
      ({ vx, vy }) => (maxSpeed2 = Math.max(maxSpeed2, vx * vx + vy * vy)),
    );
    const steps = Math.ceil((Math.sqrt(maxSpeed2) * frames) / 4);

    for (let i = 0; i < steps; i++) {
      gameStateTick(mainGameState, frames / steps);
    }
  }
  mainGameState.lastPuckPosition = mainGameState.puckPosition;

  if (mainGameState.running || mainGameState.needsRender) {
    mainGameState.needsRender = false;
    if (gameCanvas.width && gameCanvas.height) {
      render(mainGameState, ctx);
    }
  }
  startWork("record video");
  if (mainGameState.running) {
    recordOneFrame(mainGameState);
  }
  startWork("sound");
  if (isOptionOn("sound")) {
    playPendingSounds(mainGameState);
  }
  startWork("idle");
  if (isOptionOn("notch_space")) {
    document.body.classList.add("notch_space");
  } else {
    document.body.classList.remove("notch_space");
  }

  requestAnimationFrame(tick);
}

setInterval(() => {
  monitorLevelsUnlocks(mainGameState);
}, 500);

document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    pause(true);
  }
});
if (getSettingValue("score-opened", 0) < 1) {
  scoreDisplay.classList.add("button-look");
}
const menuDisplay = document.getElementById("menu") as HTMLButtonElement;
if (getSettingValue("menu-opened", 0) < 1) {
  menuDisplay.classList.add("button-look");
}

function scoreOpen(e: MouseEvent) {
  e.preventDefault();
  if (alertsOpen) return;

  setSettingValue("score-opened", getSettingValue("score-opened", 0) + 1);
  scoreDisplay.classList.remove("button-look");
  openScorePanel(mainGameState);
}

scoreDisplay.addEventListener("click", scoreOpen);
scoreDisplay.addEventListener("mousedown", scoreOpen);

menuDisplay.addEventListener("click", (e) => {
  e.preventDefault();
  if (!alertsOpen) {
    setSettingValue("menu-opened", getSettingValue("menu-opened", 0) + 1);
    menuDisplay.classList.remove("button-look");
    openMainMenu();
  }
});

export const creativeModeThreshold = Math.max(
  ...upgrades.map((u) => u.threshold),
);

/** Rogue test mode : jump to the next round without clearing the bricks */
export function skipLevel() {
  if (!mainGameState.startParams.testMode) return;
  // setLevel ignores calls while paused (menu open, waiting to start), and pauses by itself
  mainGameState.running = true;
  setLevel(mainGameState, mainGameState.currentLevel + 1).then();
}

export async function openMainMenu() {
  pause(true);

  const actions: AsyncAlertAction<() => void>[] = [
    // Rogue test mode only
    ...(mainGameState.startParams.testMode
      ? [
          {
            icon: getIcon("icon:new_run"),
            text: t("rogue.skip_level"),
            help: t("rogue.skip_level_help"),
            value() {
              skipLevel();
            },
          },
        ]
      : []),
    ...getStartRunButtons(),
    creativeMode(mainGameState),
    ...runHistoryViewerMenuEntry(),
    levelEditorMenuEntry(),
    {
      icon: getIcon("icon:unlocked_upgrades"),
      text: t("unlocks.upgrades"),
      help: t("unlocks.upgrades_help", { count: upgrades.length }),
      value() {
        openUnlockedUpgradesList();
      },
    },
    {
      icon: getIcon("icon:unlocked_levels"),
      text: t("unlocks.levels"),
      help: t("unlocks.levels_help", {
        count: allLevels.filter((l) => !l.name.startsWith("icon:")).length,
      }),
      value() {
        openUnlockedLevelsList();
      },
    },

    ...donationNag(),
    {
      text: t("main_menu.settings_title"),
      help: t("main_menu.settings_help"),
      icon: getIcon("icon:settings"),
      value() {
        openSettingsMenu();
      },
    },
    helpMenuEntry(),
  ];

  const cb = await asyncAlert<() => void>({
    title: t("main_menu.title"),
    content: [
      ...actions,

      `<p>
        <span>Rogue mode fork of <a href="https://gitlab.com/lecarore/breakout71" target="_blank">Breakout 71</a>, made in France by <a href="https://lecaro.me">Renan LE CARO</a>. Modified in 2026 (rogue mode, bosses, curses, shop and more).</span>
        <span>Free software under the <a href="https://www.gnu.org/licenses/agpl-3.0.html" target="_blank">GNU AGPL v3</a>.</span>
        <a href="https://github.com/idontunderstandgitman/Breakout-rogue" target="_blank">Source code of this version</a>
        <a href="https://github.com/idontunderstandgitman/Breakout-rogue/blob/main/LICENSE" target="_blank">License</a>
        <a href="https://github.com/idontunderstandgitman/Breakout-rogue/blob/main/NOTICE.md" target="_blank">Changes</a>
      </p>`,
      `<p>
        <span>Original game:</span>
        <a href="https://breakout.lecaro.me/" target="_blank">Web version</a>
        <a href="https://gitlab.com/lecarore/breakout71" target="_blank">Gitlab</a>
        <a href="https://f-droid.org/en/packages/me.lecaro.breakout/" target="_blank">F-Droid</a>
        <a href="https://play.google.com/store/apps/details?id=me.lecaro.breakout" target="_blank">Google Play</a>
        <a href="https://renanlecaro.itch.io/breakout71" target="_blank">itch.io</a>
        <a href="https://buy.stripe.com/00w4gz9gI4v47Vk4W40gw01" target="_blank">Donate to the original author</a>
        <a href="https://discord.gg/bbcQw4x5zA" target="_blank">Discord</a>
        <a href="https://hosted.weblate.org/projects/breakout-71/" target="_blank">Weblate</a>
        <span>v.${appVersion}</span>
      </p>`,
    ],
    allowClose: true,
  });
  if (cb) {
    cb();
    mainGameState.needsRender = true;
  }
}

function donationNag() {
  if (!isOptionOn("donation_reminder")) return [];
  const hours = hoursSpentPlaying();
  return [
    {
      text: t("main_menu.donate", { hours }),
      help: t("main_menu.donate_help", {
        suggestion: Math.min(20, Math.max(1, 0.2 * hours)).toFixed(0),
      }),
      icon: getIcon("icon:premium"),
      value() {
        window.open("https://buy.stripe.com/00w4gz9gI4v47Vk4W40gw01", "_blank");
      },
    },
  ];
}

async function openSettingsMenu() {
  pause(true);

  const actions: AsyncAlertAction<() => void>[] = [];

  actions.push({
    icon: getIcon(
      languages.find((l) => l.value === getCurrentLang())?.levelName || "",
    ),
    text: t("settings.language"),
    help: t("settings.language_help"),
    async value() {
      const pick = await asyncAlert({
        id: "select_language",
        title: t("settings.language"),
        content: [
          t("settings.language_help"),
          ...languages.map((l) => ({ ...l, icon: getIcon(l.levelName) })),
        ],
        allowClose: true,
      });
      if (
        pick &&
        pick !== getCurrentLang() &&
        (await confirmRestart(mainGameState))
      ) {
        setSettingValue("lang", pick);
        commitSettingsChangesToLocalStorage();
        window.location.reload();
      }
    },
  });
  for (const key of Object.keys(options) as OptionId[]) {
    // Skip displaying option if it does nothing
    if (options[key]) {
      actions.push({
        icon: getCheckboxIcon(isOptionOn(key)),
        text: options[key].name,
        help: options[key].help,
        disabled:
          (isOptionOn("basic") &&
            [
              "extra_bright",
              "contrast",
              "smooth_lighting",
              "precise_lighting",
              "probabilistic_lighting",
            ].includes(key)) ||
          (!isOptionOn("particles") && ["missed_shot_trail"].includes(key)) ||
          (!isOptionOn("sound") && ["menu_sound"].includes(key)) ||
          (key === "goofy_text" && !currentLanguageSupportsHeavyFontWeight()) ||
          false,
        value: () => {
          toggleOption(key);
          fitSize(mainGameState);
          applyFullScreenChoice();
          openSettingsMenu();
        },
      });
    }
  }
  actions.push({
    icon: getIcon("icon:download"),
    text: t("settings.download_save_file"),
    help: t("settings.download_save_file_help"),
    async value() {
      const dlLink = document.createElement("a");
      const obj = {
        fileType: "B71-save-file",
        appVersion,
        payload: generateSaveFileContent(),
      };
      const json = JSON.stringify(obj, null, 2);
      dlLink.setAttribute(
        "href",
        "data:application/json;charset=utf-8," + encodeURIComponent(json),
      );

      dlLink.setAttribute(
        "download",
        "b71-save-" +
          new Date()
            .toISOString()
            .slice(0, 19)
            .replace(/[^0-9]+/gi, "-") +
          ".json",
      );
      document.body.appendChild(dlLink);
      dlLink.click();
      setTimeout(() => document.body.removeChild(dlLink), 1000);
    },
  });

  actions.push({
    icon: getIcon("icon:upload"),
    text: t("settings.load_save_file"),
    help: t("settings.load_save_file_help"),
    async value() {
      if (!document.getElementById("save_file_picker")) {
        let input: HTMLInputElement = document.createElement("input");
        input.setAttribute("type", "file");
        input.setAttribute("id", "save_file_picker");
        input.setAttribute("accept", ".b71,.json");
        input.style.position = "absolute";
        input.style.left = "-1000px";
        input.addEventListener("change", async (e) => {
          try {
            const file = input && input.files?.item(0);
            if (file) {
              const content = await new Promise<string>((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = function () {
                  resolve(reader.result?.toString() || "");
                };
                reader.onerror = function () {
                  reject(reader.error);
                };

                // Read the file as a text string

                reader.readAsText(file);
              });
              const { fileType, signedPayload, payload } = JSON.parse(content);
              if (fileType !== "B71-save-file")
                throw new Error("Not a B71 save file");
              if (payload) {
                localStorage.clear();
                for (let key in payload) {
                  localStorage.setItem(key, JSON.stringify(payload[key]));
                }
              } else if (signedPayload) {
                //   Old file format
                const localStorageContent = JSON.parse(signedPayload);
                localStorage.clear();
                for (let key in localStorageContent) {
                  localStorage.setItem(key, localStorageContent[key]);
                }
              }
              await asyncAlert({
                id: "save_file_loaded",
                title: t("settings.save_file_loaded"),
                content: [
                  t("settings.save_file_loaded_help"),
                  { text: t("settings.save_file_loaded_ok") },
                ],
              });
              window.location.reload();
            }
          } catch (e: any) {
            await asyncAlert({
              id: "save_file_error",
              title: t("settings.save_file_error"),
              content: [e.message, { text: t("settings.save_file_loaded_ok") }],
            });
          }
          input.value = "";
        });
        document.body.appendChild(input);
      }
      document.getElementById("save_file_picker")?.click();
    },
  });

  actions.push({
    icon: getIcon("icon:coins"),
    text: t("settings.max_coins", { max: getCurrentMaxCoins() }),
    help: t("settings.max_coins_help"),
    async value() {
      cycleMaxCoins();
      await openSettingsMenu();
    },
  });

  actions.push({
    icon: getIcon("icon:reset"),
    text: t("settings.reset"),
    help: t("settings.reset_help"),
    async value() {
      if (
        await asyncAlert({
          id: "reset",
          title: t("settings.reset"),
          content: [
            t("settings.reset_instruction"),
            {
              text: t("settings.reset_confirm"),
              value: true,
            },
            {
              text: t("settings.reset_cancel"),
              value: false,
            },
          ],
          allowClose: true,
        })
      ) {
        localStorage.clear();
        window.location.reload();
      }
    },
  });
  actions.push({
    text: t("settings.autoplay"),
    help: t("settings.autoplay_help"),
    async value() {
      startComputerControlledGame("autoplay");
    },
  });
  actions.push({
    text: t("settings.stress_test"),
    help: t("settings.stress_test_help"),
    async value() {
      startComputerControlledGame("stress");
    },
  });

  const cb = await asyncAlert<() => void>({
    title: t("main_menu.settings_title"),
    content: [t("main_menu.settings_help"), ...actions],
    allowClose: true,
    className: "settings",
  });
  if (cb) {
    cb();
    mainGameState.needsRender = true;
  }
}

async function applyFullScreenChoice() {
  try {
    if (!(document.fullscreenEnabled || document.webkitFullscreenEnabled)) {
      return false;
    }

    if (document.fullscreenElement !== null && !isOptionOn("fullscreen")) {
      if (document.exitFullscreen) {
        await document.exitFullscreen();
        return true;
      } else if (document.webkitCancelFullScreen) {
        await document.webkitCancelFullScreen();
        return true;
      }
    } else if (isOptionOn("fullscreen") && !document.fullscreenElement) {
      const docel = document.documentElement;
      if (docel.requestFullscreen) {
        await docel.requestFullscreen();
        return true;
      } else if (docel.webkitRequestFullscreen) {
        await docel.webkitRequestFullscreen();
        return true;
      }
    }
  } catch (e) {
    console.warn(e);
  }
  return false;
}

export async function confirmRestart(gameState: GameState) {
  if (!gameState.currentLevel) return true;
  if (alertsOpen) return true;
  pause(true);
  return asyncAlert({
    id: "confirmRestart",
    title: t("confirmRestart.title"),
    content: [
      t("confirmRestart.text"),
      {
        value: true,
        text: t("confirmRestart.yes"),
      },
      {
        value: false,
        text: t("confirmRestart.no"),
      },
    ],
  });
}

const pressed: { [k: string]: number } = {
  ArrowLeft: 0,
  ArrowRight: 0,
  Shift: 0,
};

export function setKeyPressed(key: string, on: 0 | 1) {
  pressed[key] = on;
  mainGameState.keyboardPuckSpeed =
    ((pressed.ArrowRight - pressed.ArrowLeft) *
      (1 + pressed.Shift * 2) *
      mainGameState.gameZoneWidth) /
    50;
}

document.addEventListener("keydown", async (e) => {
  if (e.key.toLowerCase() === "f" && !e.ctrlKey && !e.metaKey) {
    toggleOption("fullscreen");
    applyFullScreenChoice();
  } else if (e.key in pressed) {
    setKeyPressed(e.key, 1);
  }
  if (e.key === " " && !alertsOpen) {
    if (mainGameState.running) {
      pause(true);
    } else {
      play();
    }
  } else {
    return;
  }
  e.preventDefault();
});

let pageLoad = Date.now();
document.addEventListener("keyup", async (e) => {
  const focused = document.querySelector("button:focus");
  if (e.key in pressed) {
    setKeyPressed(e.key, 0);
  } else if (
    e.key === "ArrowDown" &&
    focused?.nextElementSibling?.tagName === "BUTTON"
  ) {
    (focused?.nextElementSibling as HTMLButtonElement)?.focus();
  } else if (
    e.key === "ArrowUp" &&
    focused?.previousElementSibling?.tagName === "BUTTON"
  ) {
    (focused?.previousElementSibling as HTMLButtonElement)?.focus();
  } else if (e.key === "Escape" && closeModal) {
    closeModal();
  } else if (e.key === "Escape" && mainGameState.running) {
    pause(true);
  } else if (e.key.toLowerCase() === "m" && !alertsOpen) {
    openMainMenu().then();
  } else if (
    e.key.toLowerCase() === "n" &&
    !alertsOpen &&
    mainGameState.startParams.testMode
  ) {
    skipLevel();
  } else if (e.key.toLowerCase() === "s" && !alertsOpen) {
    openScorePanel(mainGameState).then();
  } else if (
    e.key.toLowerCase() === "r" &&
    !alertsOpen &&
    pageLoad < Date.now() - 500 &&
    ["normal", "rogue"].includes(mainGameState.startParams.runType)
  ) {
    // When doing ctrl + R in dev to refresh, i don't want to instantly restart a run
    if (await confirmRestart(mainGameState)) {
      restart({
        testMode: mainGameState.startParams.testMode,
        runType: mainGameState.startParams.runType,
        levelToAvoid: currentLevelInfo(mainGameState).name,
      });
      setSettingValue("autosave", null);
    }
  } else if (
    e.key.toLowerCase() === "r" &&
    !alertsOpen &&
    mainGameState.startParams.runType === "creative"
  ) {
    restart(mainGameState.startParams);
  } else {
    return;
  }
  e.preventDefault();
});

export const mainGameState = newGameState({ runType: "normal" });
window.mainGameState = mainGameState;

export async function restart(params: RunParams) {
  // just to reset counters
  isPerformanceTerrible();
  if (mainGameState.currentLevel > 0 && !mainGameState.isGameOver) {
    addGameToHistory(mainGameState);
  }
  Object.assign(mainGameState, newGameState(params));
  // Recompute brick size according to level
  fitSize(mainGameState);

  pauseRecording();
  await setLevel(mainGameState, 0);
  if (isComputerControlled(mainGameState)) {
    await play();
  }
}
if (window.location.search.match(/autoplay|stress/)) {
  startComputerControlledGame(
    window.location.search.includes("stress") ? "stress" : "autoplay",
  );
} else {
  restart({
    runType: "normal",
  });
  let saved = getSettingValue<GameState | null>("autosave", null);

  if (
    isOptionOn("enable_autosave") &&
    saved &&
    saved.gameVersion === appVersion
  ) {
    asyncAlert({
      title: t("play.confirm_resume_autosave"),
      content: [
        t("play.confirm_resume_autosave_help", { lvl: saved.currentLevel + 1 }),
        {
          value: false,
          text: t("play.confirm_resume_autosave_no"),
        },
        {
          value: true,
          text: t("play.confirm_resume_autosave_yes"),
        },
      ],
    }).then((load) => {
      if (load) {
        Object.assign(mainGameState, saved);
        fitSize(mainGameState);
        loadLevelBackground(mainGameState.level);
        toast(t("play.auto_save_resumed"));
      } else {
        setSettingValue("autosave", null);
      }
    });
  }
}

export function startComputerControlledGame(runType: RunType) {
  const perks: Partial<PerksMap> = { base_combo: 20, pierce: 3 };
  if (runType === "stress") {
    Object.assign(perks, {
      base_combo: 150,
      pierce: 20,
      rainbow: 3,
      sapper: 2,
      etherealcoins: 1,
      bricks_attract_ball: 1,
      respawn: 3,
    });
  } else {
    for (let i = 0; i < 10; i++) {
      const u = sample(upgrades);
      perks[u.id] ||= Math.floor(Math.random() * u.max) + 1;
      if (u.requires.length) {
        perks[sample(u.requires)] ||= 1;
      }
    }
    perks.superhot = 0;
  }
  restart({
    runType,
    level: sample(allLevels.filter((l) => l.color === "#000000")),
    perks,
  });
}

tick();
setupTooltips();
document
  .getElementById("menu")
  ?.setAttribute("data-tooltip", t("play.menu_tooltip"));

if (window.location.search.includes("skipplaying")) {
  window["skipplaying"] = true;
}
