import { GameState, PerkId, RunParams, Upgrade } from "./types";
import { newGameState } from "./newGameState";
import { render } from "./render";
import {
  gameStateTick,
  normalizeGameState,
  putBallsAtPuck,
  setLevel,
} from "./gameStateMutators";
import { allLevelsAndIcons, upgrades } from "./loadGameData";
import { clamp } from "./pure_functions";
import { t } from "./i18n/i18n";
import { sample } from "./game_utils";

let counter = 0;

export function getGameAnimation(params: RunParams) {
  const width = 270,
    height = 400;
  counter++;
  const id = "preview_" + counter;
  setTimeout(async () => {
    let gameState: GameState;

    let ctx: CanvasRenderingContext2D;

    async function reset() {
      gameState = newGameState({
        ...params,
        runType: "animated_perk_preview",
      });
      await setLevel(gameState, 0);
      gameState.canvasWidth = width;
      gameState.canvasHeight = height;
      gameState.gameZoneHeight = height - 20;
      gameState.ballSize = 14;
      gameState.puckHeight = 20;
      gameState.ballStickToPuck = false;
      gameState.puckWidth = 0;
      gameState.puckPosition = width / 2;

      gameState.brickWidth =
        Math.floor(
          width / (gameState.level.size + gameState.perks.unbounded * 2) / 2,
        ) * 2;

      gameState.gameZoneWidth = gameState.brickWidth * gameState.gridSize;
      gameState.offsetX = Math.floor(
        (gameState.canvasWidth - gameState.gameZoneWidth) / 2,
      );
      gameState.offsetXRoundedDown = 0;

      gameState.gameZoneWidthRoundedUp = width;
      gameState.running = true;
      normalizeGameState(gameState);
      putBallsAtPuck(gameState);
    }

    async function previewFrame() {
      if (!gameState) return;
      if (gameState.isGameOver) await reset();
      const canvas = document.getElementById(id) as HTMLCanvasElement;
      if (!canvas) return;

      if (!ctx) {
        ctx = canvas.getContext("2d", {
          alpha: false,
        }) as CanvasRenderingContext2D;
      }
      let frames = 1;
      if (gameState.perks.superhot) {
        frames *= clamp(
          Math.abs(gameState.puckPosition - gameState.lastPuckPosition) / 2,
          0.3 / gameState.perks.superhot,
          1,
        );
      }

      gameState.lastPuckPosition = gameState.puckPosition;

      gameState.levelTime += (1000 / 60) * frames;
      gameStateTick(gameState, frames);
      normalizeGameState(gameState);
      render(gameState, ctx);
      requestAnimationFrame(previewFrame);
    }

    await reset();
    previewFrame();
  });
  const morePerks = Object.keys(params.perks || {}).length > 1;

  return (
    `<canvas class="game_preview" id="${id}" width="${width}" height="${height}"></canvas>` +
    (morePerks
      ? `<p class="with_extra">${t("unlocks.extra_perks_for_preview")}</p>`
      : "")
  );
}

const customSettings: Partial<Record<PerkId, { perks?: RunParams["perks"] }>> =
  {
    shocks: {
      perks: {
        multiball: 3,
        shocks: 1,
      },
    },
    slow_down: {
      perks: {
        slow_down: 3,
      },
    },
    viscosity: {
      perks: {
        viscosity: 3,
      },
    },
    coin_magnet: {
      perks: { coin_magnet: 2, base_combo: 2 },
    },
    bigger_explosions: {
      perks: {
        bigger_explosions: 1,
        pierce: 2,
        concave_puck: 1,
      },
    },
    soft_reset: {
      perks: {
        soft_reset: 2,
        streak_shots: 1,
        hot_start: 3,
      },
    },
    sacrifice: {
      perks: {
        sacrifice: 1,
        extra_life: 4,
        base_combo: 3,
      },
    },
    buoy: {
      perks: {
        buoy: 2,
        base_combo: 2,
      },
    },
    metamorphosis: {
      perks: {
        metamorphosis: 1,
        pierce: 2,
      },
    },
    ball_repulse_ball: {
      perks: {
        ball_repulse_ball: 1,
        multiball: 3,
        pierce: 1,
      },
    },
    puck_repulse_ball: {
      perks: {
        puck_repulse_ball: 2,
      },
    },
    ghost_coins: {
      perks: {
        ghost_coins: 1,
        pierce: 3,
        base_combo: 1,
      },
    },
    implosions: {
      perks: {
        implosions: 1,
        pierce: 2,
        concave_puck: 1,
      },
    },
    rainbow: {
      perks: {
        rainbow: 1,
        pierce: 1,
        base_combo: 2,
      },
    },
  };

export function getPerkAnimation(perkId: PerkId) {
  const { requires } = upgrades.find((u) => u.id === perkId) as Upgrade;

  const demoParams: RunParams = {
    perks: { [perkId]: 1 },
    level: allLevelsAndIcons.find((l) => l.name === "icon:" + perkId),
  };
  if (customSettings[perkId]?.perks) {
    Object.assign(demoParams.perks, customSettings[perkId].perks);
  }
  if (requires.length) {
    demoParams.perks[sample(requires)] ||= 1;
  }
  return getGameAnimation(demoParams);
}
