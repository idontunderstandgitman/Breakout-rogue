import { rogueHudExtras } from "./rogue";
import { baseCombo, getPredictableBallDirection } from "./gameStateMutators";
import {
  baseBrickHP,
  brickCenterX,
  brickCenterY,
  countBrickColors,
  currentLevelInfo,
  getCoinRenderColor,
  getCornerOffset,
  isBrickOverPaddle,
  isMovingWhilePassiveIncome,
  isPickyEatingPossible,
  reachRedRowIndex,
  renderMaxLevel,
  telekinesisEffectRate,
  yoyoEffectRate,
  zoneLeftBorderX,
  zoneRightBorderX,
} from "./game_utils";
import { colorString, GameState } from "./types";
import { currentLanguageSupportsHeavyFontWeight, t } from "./i18n/i18n";
import { mainGameState } from "./game";
import { isOptionOn } from "./options";
import {
  ballTransparency,
  catchRateBest,
  catchRateGood,
  clamp,
  countDifferentColorBricks,
  forEachLiveOne,
  isComputerControlled,
  levelTimeBest,
  levelTimeGood,
  liveCount,
  missesBest,
  missesGood,
} from "./pure_functions";
import { lastMeasuredFPS, startWork } from "./fps";
import { hashCode } from "./getLevelBackground";
import { palette } from "./loadGameData";
import { formatFullNumber, shortenBigNumber } from "./format_number";

export const gameCanvas = document.getElementById("game") as HTMLCanvasElement;

export const bombSVG = document.createElement("img");
bombSVG.src =
  "data:image/svg+xml;base64," +
  btoa(`<svg width="144" height="144" viewBox="0 0 38.101 38.099" xmlns="http://www.w3.org/2000/svg">
 <path d="m6.1528 26.516c-2.6992-3.4942-2.9332-8.281-.58305-11.981a10.454 10.454 0 017.3701-4.7582c1.962-.27726 4.1646.05953 5.8835.90027l.45013.22017.89782-.87417c.83748-.81464.91169-.87499 1.0992-.90271.40528-.058713.58876.03425 1.1971.6116l.55451.52679 1.0821-1.0821c1.1963-1.1963 1.383-1.3357 2.1039-1.5877.57898-.20223 1.5681-.19816 2.1691.00897 1.4613.50314 2.3673 1.7622 2.3567 3.2773-.0058.95654-.24464 1.5795-.90924 2.3746-.40936.48928-.55533.81057-.57898 1.2737-.02039.41018.1109.77714.42322 1.1792.30172.38816.3694.61323.2797.93044-.12803.45666-.56674.71598-1.0242.60507-.601-.14597-1.3031-1.3088-1.3969-2.3126-.09459-1.0161.19245-1.8682.92392-2.7432.42567-.50885.5643-.82851.5643-1.3031 0-.50151-.14026-.83177-.51211-1.2028-.50966-.50966-1.0968-.64829-1.781-.41996l-.37348.12477-2.1006 2.1006.52597.55696c.45421.48194.5325.58876.57898.78855.09622.41588.07502.45014-.88396 1.4548l-.87173.9125.26339.57979a10.193 10.193 0 01.9231 4.1001c.03996 2.046-.41996 3.8082-1.4442 5.537-.55044.928-1.0185 1.5013-1.8968 2.3241-.83503.78284-1.5526 1.2827-2.4904 1.7361-3.4266 1.657-7.4721 1.3422-10.549-.82035-.73473-.51782-1.7312-1.4621-2.2515-2.1357zm21.869-4.5584c-.0579-.19734-.05871-2.2662 0-2.4545.11906-.39142.57898-.63361 1.0038-.53005.23812.05708.54147.32455.6116.5382.06279.19163.06769 2.1805.0065 2.3811-.12558.40773-.61649.67602-1.0462.57164-.234-.05708-.51615-.30498-.57568-.50722m3.0417-2.6013c-.12313-.6222.37837-1.1049 1.0479-1.0079.18348.0261.25279.08399 1.0071.83911.75838.75838.81301.82362.84074 1.0112.10193.68499-.40365 1.1938-1.034 1.0405-.1949-.0473-.28786-.12558-1.0144-.85216-.7649-.76409-.80241-.81057-.84645-1.0316m.61323-3.0629a.85623.85623 0 01.59284-.99975c.28949-.09214 2.1814-.08318 2.3917.01141.38734.17369.6279.61078.53984.98181-.06035.25606-.35391.57327-.60181.64992-.25279.07747-2.2278.053-2.4097-.03017-.26013-.11906-.46318-.36125-.51374-.61323" fill="#fff" opacity="0.3"/>
</svg>`);
bombSVG.onload = () => (mainGameState.needsRender = true);

export const background = document.createElement("img");
background.onload = () => {
  mainGameState.needsRender = true;
};
export const backgroundCanvas = document.createElement("canvas");

export const haloCanvas = document.createElement("canvas");
const haloCanvasCtx = haloCanvas.getContext("2d", {
  alpha: false,
}) as CanvasRenderingContext2D;

export function getHaloScale() {
  return 16 * (isOptionOn("precise_lighting") ? 1 : 2);
}

let framesCounter = 0;
export function render(gameState: GameState, ctx: CanvasRenderingContext2D) {
  const isPreview = gameState.startParams.runType === "animated_perk_preview";

  const width = gameState.canvasWidth,
    height = gameState.canvasHeight;

  framesCounter++;
  startWork("render:init");
  const level = currentLevelInfo(gameState);
  const hasCombo = gameState.combo > baseCombo(gameState);

  if (!isPreview) {
    startWork("render:currentLevelDisplay");
    updateMenuDisplay(gameState);
    startWork("render:scoreDisplay");
    updateScoreDisplay(gameState);
  }
  // Clear
  if (
    !isOptionOn("basic") &&
    !isPreview &&
    level.svg &&
    level.color === "#000000"
  ) {
    const skipN =
      isOptionOn("probabilistic_lighting") && liveCount(gameState.coins) > 150
        ? 3
        : 0;
    const shouldSkip = (index: number) =>
      skipN ? (framesCounter + index) % (skipN + 1) !== 0 : false;

    const haloScale = getHaloScale();
    startWork("render:halo:clear");

    haloCanvasCtx.globalCompositeOperation = "source-over";
    haloCanvasCtx.globalAlpha = skipN ? 0.1 : 0.99;
    haloCanvasCtx.fillStyle = level.color;
    haloCanvasCtx.fillRect(0, 0, width / haloScale, height / haloScale);

    const brightness = isOptionOn("extra_bright") ? 3 : 1;
    haloCanvasCtx.globalCompositeOperation = "lighten";
    haloCanvasCtx.globalAlpha =
      0.1 + (0.5 * 10) / (liveCount(gameState.coins) + 10);
    startWork("render:halo:coins");
    forEachLiveOne(gameState.coins, (coin, index) => {
      if (shouldSkip(index)) return;
      const color = getCoinRenderColor(gameState, coin);
      drawFuzzyBall(
        haloCanvasCtx,
        color,
        (gameState.coinSize * 2 * brightness) / haloScale,
        coin.x / haloScale,
        coin.y / haloScale,
      );
    });

    startWork("render:halo:balls");
    gameState.balls.forEach((ball, index) => {
      if (shouldSkip(index)) return;
      haloCanvasCtx.globalAlpha = 0.3 * (1 - ballTransparency(ball, gameState));
      drawFuzzyBall(
        haloCanvasCtx,
        gameState.ballsColor,
        ((gameState.ballSize + 20) * brightness) / haloScale,
        ball.x / haloScale,
        ball.y / haloScale,
      );
    });

    startWork("render:halo:bricks");
    haloCanvasCtx.globalAlpha = 0.05;
    gameState.bricks.forEach((color, index) => {
      if (!color) return;
      if (shouldSkip(index)) return;
      const x = brickCenterX(gameState, index),
        y = brickCenterY(gameState, index);
      drawFuzzyBall(
        haloCanvasCtx,
        color == "black" ? "#666666" : color,
        // Perf could really go down there because of the size of the halo
        Math.min(200, gameState.brickWidth * 1.5 * brightness) / haloScale,
        x / haloScale,
        y / haloScale,
      );
    });

    startWork("render:halo:particles");
    haloCanvasCtx.globalCompositeOperation = "screen";
    forEachLiveOne(gameState.particles, (flash, index) => {
      if (shouldSkip(index)) return;
      const { x, y, time, color, size, duration } = flash;
      const elapsed = gameState.levelTime - time;
      haloCanvasCtx.globalAlpha =
        0.1 * Math.min(1, 2 - (elapsed / duration) * 2);
      drawFuzzyBall(
        haloCanvasCtx,
        color,
        (size * 3 * brightness) / haloScale,
        x / haloScale,
        y / haloScale,
      );
    });

    startWork("render:halo:scale_up");
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";

    ctx.imageSmoothingQuality = "high";
    ctx.imageSmoothingEnabled = isOptionOn("smooth_lighting") || false;
    ctx.drawImage(haloCanvas, 0, 0, width, height);
    ctx.imageSmoothingEnabled = false;

    startWork("render:halo:pattern");
    if (level.svg && background.width && background.complete) {
      if (backgroundCanvas.title !== level.name) {
        backgroundCanvas.title = level.name;
        backgroundCanvas.width = gameState.canvasWidth;
        backgroundCanvas.height = gameState.canvasHeight;
        const bgctx = backgroundCanvas.getContext(
          "2d",
        ) as CanvasRenderingContext2D;
        bgctx.globalCompositeOperation = "source-over";
        bgctx.fillStyle = level.color || "#000";
        bgctx.fillRect(0, 0, gameState.canvasWidth, gameState.canvasHeight);
        if (gameState.perks.clairvoyant >= 3) {
          const pageSource = document.body.innerHTML.replace(/\s+/gi, "");
          const lineWidth = Math.ceil(gameState.canvasWidth / 15);
          const lines = Math.ceil(gameState.canvasHeight / 20);
          const chars = lineWidth * lines;
          let start = Math.ceil(Math.random() * (pageSource.length - chars));
          for (let i = 0; i < lines; i++) {
            bgctx.fillStyle = "#FFFFFF";
            bgctx.font = "20px Courier";
            bgctx.fillText(
              pageSource.slice(
                start + i * lineWidth,
                start + (i + 1) * lineWidth,
              ),
              0,
              i * 20,
              gameState.canvasWidth,
            );
          }
        } else {
          const pattern = ctx.createPattern(background, "repeat");
          if (pattern) {
            bgctx.globalCompositeOperation = "screen";
            bgctx.fillStyle = pattern;
            // screen it twice to get thicker white lines, as we multiply later
            bgctx.fillRect(0, 0, width, height);
            bgctx.fillRect(0, 0, width, height);
          }
        }
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "multiply";
      // ctx.globalCompositeOperation = "darken";
      ctx.drawImage(backgroundCanvas, 0, 0);
    } else {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "multiply";
      // Background not loaded yes
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, width, height);
    }
  } else {
    startWork("render:halo-basic");
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = level.color || "#000";
    ctx.fillRect(0, 0, width, height);
    forEachLiveOne(gameState.particles, (flash) => {
      const { x, y, time, color, size, duration } = flash;
      const elapsed = gameState.levelTime - time;
      ctx.globalAlpha = Math.min(1, 2 - (elapsed / duration) * 2);
      drawBall(ctx, color, size, x, y);
    });
  }

  startWork("render:explosionshake");
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  const lastExplosionDelay = gameState.levelTime - gameState.lastExplosion + 5;

  const shaked =
    lastExplosionDelay < 200 &&
    // Otherwise, if you pause after an explosion, moving the mouses shakes the picture
    gameState.running &&
    isOptionOn("shake");
  if (shaked) {
    const amplitude =
      ((gameState.perks.bigger_explosions + 1) * 50) / lastExplosionDelay;
    ctx.translate(
      Math.sin(Date.now()) * amplitude,
      Math.sin(Date.now() + 36) * amplitude,
    );
  }
  startWork("render:coins");
  // Coins
  ctx.globalAlpha = 1;
  forEachLiveOne(gameState.coins, (coin) => {
    const color = getCoinRenderColor(gameState, coin);
    const hollow = gameState.perks.metamorphosis && !coin.metamorphosisPoints;

    ctx.globalCompositeOperation = "source-over";
    drawCoin(
      ctx,
      hollow ? "transparent" : color,
      coin.size,
      coin.x,
      coin.y,
      // Red border around coins with asceticism
      (hasCombo && gameState.perks.asceticism && "#FF0000") ||
        // Gold coins
        // (color === "#ffd300" && "#ffd300") ||
        (hollow && color) ||
        gameState.level.color,
      coin.a,
    );
  });
  startWork("render:ball shade");
  // Black shadow around balls
  ctx.globalCompositeOperation = "source-over";
  gameState.balls.forEach((ball) => {
    ctx.globalAlpha =
      Math.min(0.8, liveCount(gameState.coins) / 20) *
      (1 - ballTransparency(ball, gameState));

    drawBall(
      ctx,
      level.color || "#000",
      gameState.ballSize + 100,
      ball.x,
      ball.y,
    );
  });
  startWork("render:bricks");
  ctx.globalCompositeOperation = "source-over";
  renderAllBricks(gameState, ctx);

  startWork("render:lights");
  ctx.globalCompositeOperation = "source-over";
  forEachLiveOne(gameState.lights, (flash) => {
    const { x, y, time, color, size, duration } = flash;
    const elapsed = gameState.levelTime - time;
    ctx.globalAlpha = Math.min(1, 2 - (elapsed / duration) * 2) * 0.5;
    drawBrick(
      gameState,
      ctx,
      color,
      x,
      y,
      -1,
      gameState.perks.clairvoyant >= 2,
      gameState.perks.round_bricks > 0,
      0,
    );
  });

  ctx.globalCompositeOperation = "screen";
  startWork("render:particles");
  forEachLiveOne(gameState.particles, (particle) => {
    const { x, y, time, color, size, duration } = particle;
    const elapsed = gameState.levelTime - time;
    ctx.globalAlpha = Math.max(0, Math.min(1, 2 - (elapsed / duration) * 2));
    drawBall(ctx, color, size, x, y);
  });

  startWork("render:extra_life");
  if (gameState.perks.extra_life) {
    ctx.globalAlpha = gameState.balls.length > 1 ? 0.2 : 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.fillStyle = gameState.puckColor;
    ctx.fillRect(
      gameState.offsetXRoundedDown,
      gameState.gameZoneHeight - 4,
      gameState.gameZoneWidthRoundedUp,
      1,
    );
  }

  startWork("render:helium_bars");
  if (
    (gameState.perks.helium ||
      gameState.perks.paddle_up_combo ||
      gameState.perks.pierce_above_paddle ||
      gameState.perks.soft_touch) &&
    isOptionOn("show_puck_rails")
  ) {
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
    ctx.strokeStyle = gameState.ballsColor;
    ctx.beginPath();
    ctx.moveTo(
      Math.round(gameState.puckPosition - gameState.puckWidth / 2),
      gameState.gameZoneHeight,
    );
    ctx.lineTo(Math.round(gameState.puckPosition - gameState.puckWidth / 2), 0);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(
      Math.round(gameState.puckPosition + gameState.puckWidth / 2),
      gameState.gameZoneHeight,
    );
    ctx.lineTo(Math.round(gameState.puckPosition + gameState.puckWidth / 2), 0);
    ctx.stroke();
  }

  startWork("render:paddle");
  ctx.globalAlpha = isMovingWhilePassiveIncome(gameState) ? 0.2 : 1;
  ctx.globalCompositeOperation = "source-over";
  drawPuck(
    ctx,
    gameState,
    0,
    gameState.perks.concave_puck,
    gameState.perks.streak_shots && hasCombo ? getDashOffset(gameState) : -1,
  );

  startWork("render:combotext");
  const spawns = gameState.combo;
  if (spawns > 1 && !isMovingWhilePassiveIncome(gameState)) {
    ctx.globalCompositeOperation = "source-over";
    ctx.globalAlpha = 1;

    const comboText = shortenBigNumber(spawns);
    const comboTextWidth = (comboText.length * gameState.puckHeight) / 1.8;
    const totalWidth = comboTextWidth + gameState.coinSize * 2;
    const left = gameState.puckPosition - totalWidth / 2;

    ctx.globalAlpha = gameState.combo > baseCombo(gameState) ? 1 : 0.3;
    if (totalWidth < gameState.puckWidth) {
      drawText(
        ctx,
        comboText,
        "#000",
        gameState.puckHeight,
        left + gameState.coinSize * 1.5,
        gameState.gameZoneHeight - gameState.puckHeight / 2,
        true,
        0,
      );

      ctx.globalAlpha = 1;
      drawCoin(
        ctx,
        "#ffd300",
        gameState.coinSize,
        left + gameState.coinSize / 2,
        gameState.gameZoneHeight - gameState.puckHeight / 2,
        "#ffd300",
        0,
      );
    } else {
      drawText(
        ctx,
        comboTextWidth > gameState.puckWidth
          ? gameState.combo.toString()
          : comboText,
        "#000",
        comboTextWidth > gameState.puckWidth ? 12 : 20,
        gameState.puckPosition,
        gameState.gameZoneHeight - gameState.puckHeight / 2,
        false,
        0,
      );
    }
  }
  startWork("render:borders");
  //  Borders
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;

  let redLeftSide =
    hasCombo && (gameState.perks.left_is_lava || gameState.perks.trampoline);
  let redRightSide =
    hasCombo && (gameState.perks.right_is_lava || gameState.perks.trampoline);
  let redTop =
    hasCombo && (gameState.perks.top_is_lava || gameState.perks.trampoline);

  if (gameState.offsetXRoundedDown) {
    // draw outside of gaming area to avoid capturing borders in recordings
    if (gameState.perks.left_is_lava < 2)
      drawStraightLine(
        ctx,
        gameState,
        (redLeftSide && "#FF0000") || "#FFFFFF",
        zoneLeftBorderX(gameState),
        0,
        zoneLeftBorderX(gameState),
        height,
        1,
      );
    if (gameState.perks.right_is_lava < 2)
      drawStraightLine(
        ctx,
        gameState,
        (redRightSide && "#FF0000") || "#FFFFFF",
        zoneRightBorderX(gameState),
        0,
        zoneRightBorderX(gameState),
        height,
        1,
      );
  } else {
    if (gameState.perks.left_is_lava < 2)
      drawStraightLine(
        ctx,
        gameState,
        (redLeftSide && "#FF0000") || "",
        0,
        0,
        0,
        height,
        1,
      );

    if (gameState.perks.right_is_lava < 2)
      drawStraightLine(
        ctx,
        gameState,
        (redRightSide && "#FF0000") || "",
        width - 1,
        0,
        width - 1,
        height,
        1,
      );
  }

  if (redTop && gameState.perks.top_is_lava < 2)
    drawStraightLine(
      ctx,
      gameState,
      "#FF0000",
      zoneLeftBorderX(gameState),
      1,
      zoneRightBorderX(gameState),
      1,
      1,
    );

  startWork("render:bottom_line");
  ctx.globalAlpha = 1;
  const corner = getCornerOffset(gameState);
  const bottomLineIsRed = hasCombo && gameState.perks.compound_interest;
  drawStraightLine(
    ctx,
    gameState,
    (bottomLineIsRed && "#FF0000") ||
      (isPreview && "#FFFFFF") ||
      (gameState.gameZoneHeight < gameState.canvasHeight && "#FFFFFF") ||
      (corner && "#FFFFFF") ||
      "",
    gameState.offsetXRoundedDown - corner,
    gameState.gameZoneHeight - 1,
    width - gameState.offsetXRoundedDown + corner,
    gameState.gameZoneHeight - 1,
    bottomLineIsRed ? 1 : 0.5,
  );

  startWork("render:texts");
  ctx.globalCompositeOperation = "screen";
  const boldOn =
    currentLanguageSupportsHeavyFontWeight() && isOptionOn("goofy_text");
  forEachLiveOne(gameState.texts, (flash) => {
    const { x, y, vx, vy, time, color, size, duration } = flash;
    const elapsed = gameState.levelTime - time;
    const elapsedFrames = elapsed / 60;
    ctx.globalAlpha = Math.max(0, Math.min(1, 2 - (elapsed / duration) * 2));
    for (let isClearingBg of trueFalse) {
      if (size < 15 && isClearingBg) {
        continue;
      }
      ctx.globalCompositeOperation = "source-over";
      let borderWidth =
        Math.floor(Math.sqrt(size) - 2) *
        (isClearingBg ? 4 : 1) *
        (boldOn || isClearingBg ? 1 : 0);

      drawText(
        ctx,
        flash.text,
        isClearingBg ? level.color : color,
        size,
        x + elapsedFrames * vx,
        y + elapsedFrames * vy,
        false,
        borderWidth,
      );
    }
  });

  startWork("render:balls");
  ctx.globalAlpha = 1;
  ctx.globalCompositeOperation = "source-over";
  gameState.balls.forEach((ball) => {
    const drawingColor = gameState.ballsColor;
    let ballAlpha = 1 - ballTransparency(ball, gameState);
    if (
      gameState.perks.soft_touch &&
      Math.abs(ball.x - gameState.puckPosition) >
        gameState.ballSize / 2 + gameState.puckWidth / 2
    ) {
      ballAlpha = Math.min(ballAlpha, 0.5);
    }

    ctx.globalAlpha = ballAlpha;
    // The white border around is to distinguish colored balls from coins/bg
    drawBall(
      ctx,
      drawingColor,
      gameState.ballSize,
      ball.x,
      ball.y,
      gameState.puckColor,
    );

    if (
      telekinesisEffectRate(gameState, ball) ||
      yoyoEffectRate(gameState, ball)
    ) {
      ctx.beginPath();
      ctx.moveTo(gameState.puckPosition, gameState.gameZoneHeight);
      ctx.globalAlpha = clamp(
        Math.max(
          telekinesisEffectRate(gameState, ball),
          yoyoEffectRate(gameState, ball),
        ) * ballAlpha,
        0,
        1,
      );
      ctx.strokeStyle = gameState.puckColor;
      ctx.bezierCurveTo(
        gameState.puckPosition,
        gameState.gameZoneHeight,
        gameState.puckPosition,
        ball.y,
        ball.x,
        ball.y,
      );
      ctx.stroke();

      ctx.lineWidth = 2;
      ctx.setLineDash(emptyArray);
    }

    ctx.globalAlpha = ballAlpha;
    if (
      (gameState.perks.clairvoyant && gameState.ballStickToPuck) ||
      (gameState.perks.steering > 1 && !gameState.ballStickToPuck) ||
      (gameState.ballStickToPuck &&
        typeof getPredictableBallDirection(gameState) === "number")
    ) {
      ctx.strokeStyle = gameState.ballsColor;
      ctx.beginPath();
      ctx.moveTo(ball.x, ball.y);
      ctx.lineTo(ball.x + ball.vx * 10, ball.y + ball.vy * 10);
      ctx.stroke();
    }
  });
  startWork("render:contrast");
  if (
    !isOptionOn("basic") &&
    isOptionOn("contrast") &&
    !isPreview &&
    level.svg &&
    level.color === "#000000"
  ) {
    ctx.imageSmoothingEnabled = isOptionOn("smooth_lighting") || false;

    if (isOptionOn("probabilistic_lighting")) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "soft-light";
    } else {
      haloCanvasCtx.fillStyle = "#FFFFFF";
      haloCanvasCtx.globalAlpha = 0.25;
      haloCanvasCtx.globalCompositeOperation = "screen";
      haloCanvasCtx.fillRect(0, 0, haloCanvas.width, haloCanvas.height);
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "overlay";
    }

    ctx.drawImage(haloCanvas, 0, 0, width, height);

    ctx.imageSmoothingEnabled = false;
  }

  startWork("render:text_under_puck");
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  if (isOptionOn("mobile-mode") && !gameState.running) {
    drawText(
      ctx,
      t("play.mobile_press_to_play"),
      gameState.puckColor,
      gameState.puckHeight,
      gameState.canvasWidth / 2,
      gameState.gameZoneHeight +
        (gameState.canvasHeight - gameState.gameZoneHeight) / 2,
      false,
      0,
    );
  }

  startWork("render:timeout");
  if (gameState.winAt || gameState.startCountDown) {
    const remaining =
      gameState.startCountDown ||
      Math.ceil((gameState.winAt - gameState.levelTime) / 1000);
    if (remaining > 0 && remaining < 5) {
      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = "source-over";

      drawText(
        ctx,
        remaining.toString(),
        gameState.level.color,
        60,
        gameState.canvasWidth / 2,
        gameState.canvasHeight / 2,
        false,
        10,
      );

      drawText(
        ctx,
        remaining.toString(),
        "white",
        60,
        gameState.canvasWidth / 2,
        gameState.canvasHeight / 2,
        false,
        0,
      );
    }
  }
  ctx.globalAlpha = 1;

  startWork("render:askForWakeLock");
  askForWakeLock(gameState);

  startWork("render:resetTransform");
  if (shaked) {
    ctx.resetTransform();
  }
}

function drawStraightLine(
  ctx: CanvasRenderingContext2D,
  gameState: GameState,
  mode: "#FFFFFF" | "" | "#FF0000" | string,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  alpha = 1,
) {
  ctx.globalAlpha = alpha;
  if (!mode) return;

  x1 = Math.round(x1);
  y1 = Math.round(y1);
  x2 = Math.round(x2);
  y2 = Math.round(y2);

  if (mode == "#FF0000") {
    ctx.strokeStyle = "red";
    ctx.lineDashOffset = getDashOffset(gameState);
    ctx.lineWidth = Math.ceil(2);
    ctx.setLineDash(redBorderDash);
    ctx.beginPath();
    ctx.moveTo(x1, y1);
    ctx.lineTo(x2, y2);
    ctx.stroke();
    ctx.setLineDash(emptyArray);
    ctx.lineWidth = 1;
  } else {
    const width = 1;
    ctx.fillStyle = mode;
    ctx.fillRect(
      Math.min(x1, x2),
      Math.min(y1, y2),
      Math.max(width, Math.abs(x1 - x2)),
      Math.max(width, Math.abs(y1 - y2)),
    );
  }

  if (mode == "#FF0000") {
  }
  ctx.globalAlpha = 1;
}

let cachedBricksRender = document.createElement("canvas");
let cachedBricksRenderKey = "";

export function renderAllBricks(
  gameState: GameState,
  ctx: CanvasRenderingContext2D,
) {
  ctx.globalAlpha = 1;

  const hasCombo = gameState.combo > baseCombo(gameState);

  const redBorderOnBricksWithWrongColor =
    hasCombo && gameState.perks.picky_eater && isPickyEatingPossible(gameState);

  const colorsCount = countBrickColors(gameState);
  const redBorderOnAllBricks =
    hasCombo && gameState.perks.palette && colorsCount < 2;

  const redBorderOutOfPuck =
    hasCombo &&
    gameState.perks.paddle_up_combo &&
    "" + gameState.puckPosition + "," + gameState.puckWidth;

  const redBorderOnDullNeighborhoods =
    hasCombo && gameState.perks.vibrant_neighborhood;

  const redRowReach = reachRedRowIndex(gameState);
  const { clairvoyant } = gameState.perks;
  let offset = getDashOffset(gameState);
  if (
    !(
      redBorderOnBricksWithWrongColor ||
      redRowReach !== -1 ||
      gameState.perks.zen ||
      redBorderOutOfPuck ||
      redBorderOnDullNeighborhoods
    )
  ) {
    offset = 0;
  }

  const brickHps = gameState.brickHP.reduce((a, b) => a + b, 0);

  const round = gameState.perks.round_bricks > 0;
  const newKey =
    gameState.gameZoneWidth +
    "_" +
    gameState.bricks.join("_") +
    "_" +
    // Bedrock never changes during a level but the cache must reset between levels
    (gameState.bedrock || []).map((b) => (b ? 1 : 0)).join("") +
    bombSVG.complete +
    "_" +
    redRowReach +
    "_" +
    redBorderOnBricksWithWrongColor +
    "_" +
    redBorderOnAllBricks +
    "_" +
    redBorderOnDullNeighborhoods +
    "_" +
    gameState.ballsColor +
    "_" +
    gameState.perks.pierce_color +
    "_" +
    brickHps +
    "_" +
    offset +
    "_" +
    redBorderOutOfPuck +
    "_" +
    round +
    "_";

  if (
    newKey !== cachedBricksRenderKey ||
    gameState.startParams.runType === "animated_perk_preview"
  ) {
    let canctx = ctx;

    if (gameState.startParams.runType !== "animated_perk_preview") {
      cachedBricksRenderKey = newKey;
      cachedBricksRender.width = gameState.gameZoneWidth;
      cachedBricksRender.height = gameState.gameZoneWidth + 1;
      canctx = cachedBricksRender.getContext("2d") as CanvasRenderingContext2D;
      canctx.clearRect(0, 0, gameState.gameZoneWidth, gameState.gameZoneWidth);
      canctx.resetTransform();
      canctx.translate(-gameState.offsetX, 0);
    }

    // Bricks
    gameState.bricks.forEach((color, index) => {
      const x = brickCenterX(gameState, index),
        y = brickCenterY(gameState, index);

      if (!color) return;

      let redBecauseOfReach =
        hasCombo && redRowReach === Math.floor(index / gameState.level.size);

      let redBorder =
        (gameState.ballsColor !== color &&
          color !== "black" &&
          redBorderOnBricksWithWrongColor) ||
        redBorderOnAllBricks ||
        (hasCombo && gameState.perks.zen && color === "black") ||
        redBecauseOfReach ||
        (hasCombo &&
          gameState.perks.paddle_up_combo &&
          !isBrickOverPaddle(gameState, index));

      if (redBorderOnDullNeighborhoods) {
        if (
          countDifferentColorBricks(gameState, index, color, colorsCount) === -1
        ) {
          redBorder = true;
        }
      }

      const cracks =
        color === "black" || clairvoyant
          ? 0
          : clamp(
              Math.round(baseBrickHP(gameState) - gameState.brickHP[index]),
              0,
              10,
            );

      canctx.globalCompositeOperation = "source-over";
      drawBrick(
        gameState,
        canctx,
        color,
        x,
        y,
        redBorder ? offset : -1,
        clairvoyant >= 2,
        round,
        cracks,
      );
      if (gameState.brickHP[index] > 1 && clairvoyant) {
        canctx.globalCompositeOperation = "source-over";
        drawText(
          canctx,
          Math.ceil(gameState.brickHP[index]).toString(),
          clairvoyant >= 2 ? color : gameState.level.color,
          gameState.puckHeight,
          x,
          y,
          false,
          1,
        );
      }

      if (color === "black") {
        canctx.globalCompositeOperation = "source-over";
        drawIMG(canctx, bombSVG, gameState.brickWidth, x, y);
      }
    });

    // Bedrock, unbreakable
    (gameState.bedrock || []).forEach((isBedrock, index) => {
      if (!isBedrock) return;
      drawBedrock(
        gameState,
        canctx,
        brickCenterX(gameState, index),
        brickCenterY(gameState, index),
        round,
      );
    });
  }
  if (gameState.startParams.runType !== "animated_perk_preview")
    ctx.drawImage(cachedBricksRender, gameState.offsetX, 0);
}

function drawBedrock(
  gameState: GameState,
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  round: boolean,
) {
  const size = Math.ceil(gameState.brickWidth) - 1;
  const left = Math.ceil(x - gameState.brickWidth / 2);
  const top = Math.ceil(y - gameState.brickWidth / 2);
  const inset = Math.max(2, Math.round(size / 6));

  ctx.globalCompositeOperation = "source-over";
  ctx.fillStyle = "#3a3e46";
  ctx.strokeStyle = "#7d8491";
  ctx.lineWidth = 2;
  ctx.beginPath();
  if (round) {
    ctx.arc(left + size / 2, top + size / 2, size / 2.8, 0, Math.PI * 2);
  } else {
    ctx.rect(left, top, size, size);
  }
  ctx.fill();
  ctx.stroke();

  // Cross, so it can't be mistaken for a dark brick
  ctx.strokeStyle = "#7d8491";
  ctx.lineWidth = 1.5;
  ctx.beginPath();
  ctx.moveTo(left + inset, top + inset);
  ctx.lineTo(left + size - inset, top + size - inset);
  ctx.moveTo(left + size - inset, top + inset);
  ctx.lineTo(left + inset, top + size - inset);
  ctx.stroke();
}

let cachedGraphics: { [k: string]: HTMLCanvasElement } = {};

export function drawPuck(
  ctx: CanvasRenderingContext2D,
  gameState: GameState,
  yOffset = 0,
  concave_puck: number,
  redBorderOffset: number,
) {
  const { puckColor, puckWidth, puckHeight } = gameState;

  const key =
    "puck" +
    puckColor +
    "_" +
    puckWidth +
    "_" +
    puckHeight +
    "_" +
    concave_puck +
    "_" +
    redBorderOffset;

  if (!cachedGraphics[key]) {
    const can = document.createElement("canvas");
    can.width = puckWidth;
    can.height = puckHeight * 2;
    const canctx = can.getContext("2d") as CanvasRenderingContext2D;
    canctx.fillStyle = puckColor;

    canctx.beginPath();
    canctx.moveTo(0, puckHeight * 2);

    if (concave_puck) {
      canctx.lineTo(0, puckHeight * 0.75);
      canctx.bezierCurveTo(
        puckWidth / 2,
        (puckHeight * (2 + concave_puck)) / 3,
        puckWidth / 2,
        (puckHeight * (2 + concave_puck)) / 3,
        puckWidth,
        puckHeight * 0.75,
      );
      canctx.lineTo(puckWidth, puckHeight * 2);
    } else {
      canctx.lineTo(0, puckHeight * 1.25);
      canctx.bezierCurveTo(
        0,
        puckHeight * 0.75,
        puckWidth,
        puckHeight * 0.75,
        puckWidth,
        puckHeight * 1.25,
      );
      canctx.lineTo(puckWidth, puckHeight * 2);
    }

    canctx.fill();

    if (redBorderOffset !== -1) {
      canctx.strokeStyle = "#FF0000";
      canctx.lineWidth = 4;
      canctx.setLineDash(redBorderDash);
      canctx.lineDashOffset = redBorderOffset;
      canctx.stroke();
    }

    cachedGraphics[key] = can;
  }
  ctx.drawImage(
    cachedGraphics[key],
    Math.round(gameState.puckPosition - puckWidth / 2),
    gameState.gameZoneHeight - puckHeight * 2 + yOffset,
  );
}

export function drawBall(
  ctx: CanvasRenderingContext2D,
  color: colorString,
  width: number,
  x: number,
  y: number,
  borderColor = "",
) {
  const key = "ball" + color + "_" + width + "_" + borderColor;

  const size = Math.round(width);
  if (!cachedGraphics[key]) {
    const can = document.createElement("canvas");
    can.width = size;
    can.height = size;

    const canctx = can.getContext("2d") as CanvasRenderingContext2D;
    canctx.beginPath();
    canctx.arc(size / 2, size / 2, Math.round(size / 2) - 1, 0, 2 * Math.PI);
    canctx.fillStyle = color;
    canctx.fill();
    if (borderColor) {
      canctx.lineWidth = 2;
      canctx.strokeStyle = borderColor;
      canctx.stroke();
    }

    cachedGraphics[key] = can;
  }
  ctx.drawImage(
    cachedGraphics[key],
    Math.round(x - size / 2),
    Math.round(y - size / 2),
  );
}

const angles = 32;

export function drawCoin(
  ctx: CanvasRenderingContext2D,
  color: colorString,
  size: number,
  x: number,
  y: number,
  borderColor: colorString,
  rawAngle: number,
) {
  const angle =
    ((Math.round((rawAngle / Math.PI) * 2 * angles) % angles) + angles) %
    angles;
  const key =
    "coin with halo" +
    "_" +
    color +
    "_" +
    size +
    "_" +
    borderColor +
    "_" +
    (color === "#ffd300" ? angle : "whatever");

  if (!cachedGraphics[key]) {
    const can = document.createElement("canvas");
    can.width = size;
    can.height = size;

    const canctx = can.getContext("2d") as CanvasRenderingContext2D;

    // coin
    canctx.beginPath();
    canctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
    canctx.fillStyle = color;
    canctx.fill();

    canctx.strokeStyle = borderColor;
    if (borderColor == "#FF0000") {
      canctx.lineWidth = 2;
      canctx.setLineDash(redBorderDash);
    }
    if (color === "transparent") {
      canctx.lineWidth = 2;
    }
    canctx.stroke();

    if (color === "#ffd300") {
      // Fill in
      canctx.beginPath();
      canctx.arc(size / 2, size / 2, (size / 2) * 0.6, 0, 2 * Math.PI);
      canctx.fillStyle = "rgba(255,255,255,0.5)";
      canctx.fill();

      canctx.translate(size / 2, size / 2);
      canctx.rotate(angle / 16);
      canctx.translate(-size / 2, -size / 2);

      canctx.globalCompositeOperation = "multiply";
      drawText(canctx, "$", color, size - 2, size / 2, size / 2 + 1, false, 0);
      drawText(canctx, "$", color, size - 2, size / 2, size / 2 + 1, false, 0);
    }
    cachedGraphics[key] = can;
  }
  ctx.drawImage(
    cachedGraphics[key],
    Math.round(x - size / 2),
    Math.round(y - size / 2),
  );
}

export function drawFuzzyBall(
  ctx: CanvasRenderingContext2D,
  color: colorString,
  width: number,
  x: number,
  y: number,
) {
  width = Math.max(width, 2);
  const key = "fuzzy-circle" + color + "_" + width;
  if (!color?.startsWith("#")) debugger;

  const size = Math.round(width * 3);
  if (!size || isNaN(size)) {
    debugger;
    return;
  }
  if (!cachedGraphics[key]) {
    const can = document.createElement("canvas");
    can.width = size;
    can.height = size;

    const canctx = can.getContext("2d") as CanvasRenderingContext2D;
    const gradient = canctx.createRadialGradient(
      size / 2,
      size / 2,
      0,
      size / 2,
      size / 2,
      size / 2,
    );
    gradient.addColorStop(0, color);
    gradient.addColorStop(0.3, color + "88");
    gradient.addColorStop(0.6, color + "22");
    gradient.addColorStop(1, "transparent");
    canctx.fillStyle = gradient;
    canctx.fillRect(0, 0, size, size);
    cachedGraphics[key] = can;
  }
  ctx.drawImage(
    cachedGraphics[key],
    Math.round(x - size / 2),
    Math.round(y - size / 2),
  );
}

export function drawBrick(
  gameState: GameState,
  ctx: CanvasRenderingContext2D,
  color: colorString,
  x: number,
  y: number,
  offset: number = 0,
  borderOnly: boolean,
  round: boolean = false,
  cracks = 0,
) {
  const tlx = Math.ceil(x - gameState.brickWidth / 2);
  const tly = Math.ceil(y - gameState.brickWidth / 2);
  const brx = Math.ceil(x + gameState.brickWidth / 2) - 1;
  const bry = Math.ceil(y + gameState.brickWidth / 2) - 1;

  const width = brx - tlx,
    height = bry - tly;

  const key =
    "brick" +
    color +
    "_" +
    "_" +
    width +
    "_" +
    height +
    "_" +
    offset +
    "_" +
    borderOnly +
    "_" +
    round +
    "_" +
    cracks;

  if (!cachedGraphics[key]) {
    const can = document.createElement("canvas");
    can.width = width;
    can.height = height;
    const bord = 4;
    const radius = 2;
    const canctx = can.getContext("2d") as CanvasRenderingContext2D;

    canctx.fillStyle = color;
    canctx.strokeStyle = color;
    canctx.lineJoin = "round";
    canctx.lineWidth = bord;
    if (round) {
      canctx.beginPath();
      canctx.arc(
        width / 2,
        height / 2,
        width / 2.5 - bord,
        0,
        2 * Math.PI,
        false,
      );
    } else {
      roundRect(
        canctx,
        bord / 2,
        bord / 2,
        width - bord,
        height - bord,
        radius,
      );
    }

    if (!borderOnly) {
      canctx.fill();
    }
    canctx.stroke();

    if (offset !== -1) {
      canctx.setLineDash(redBorderDash);
      canctx.lineDashOffset = offset;
      if (
        color === palette.s ||
        color === palette.r ||
        color === palette.R ||
        color === palette.S
      ) {
        canctx.globalCompositeOperation = "destination-out";
      }
      canctx.strokeStyle = palette.r;
      canctx.stroke();
    }

    drawCracks(canctx, width, height, cracks, color);
    cachedGraphics[key] = can;
  }
  ctx.drawImage(cachedGraphics[key], tlx, tly, width, height);
  // It's not easy to have a 1px gap between bricks without antialiasing
}
function drawCracks(
  canctx: CanvasRenderingContext2D,
  width: number,
  height: number,
  cracks: number,
  color: String,
) {
  let counter = 0;
  const size = Math.max(width, height);
  let rand = () => {
    counter++;
    return (
      (hashCode("cracks-step" + counter + " " + color + "-start") % 100) / 100.0
    );
  };
  for (let i = 0; i < cracks; i++) {
    canctx.strokeStyle = "black";
    canctx.lineWidth = 2;
    canctx.globalCompositeOperation = "multiply";
    canctx.globalAlpha = 1;
    canctx.setLineDash(emptyArray);
    canctx.beginPath();
    const centerX = (0.2 + rand() * 0.8) * size;
    const centerY = (0.2 + rand() * 0.8) * size;
    const angle1 = rand() * Math.PI * 2;
    const angle2 = angle1 + Math.PI + (rand() - 0.5) * Math.PI * 0.2;
    canctx.moveTo(
      centerX + Math.cos(angle1) * size,
      centerY + Math.sin(angle1) * size,
    );
    canctx.lineTo(centerX, centerY);
    canctx.lineTo(
      centerX + Math.cos(angle2) * size,
      centerY + Math.sin(angle2) * size,
    );
    canctx.stroke();
  }
}

export function roundRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
) {
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.lineTo(x + width - radius, y);
  ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
  ctx.lineTo(x + width, y + height - radius);
  ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
  ctx.lineTo(x + radius, y + height);
  ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
  ctx.lineTo(x, y + radius);
  ctx.quadraticCurveTo(x, y, x + radius, y);
  ctx.closePath();
}

export function drawIMG(
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  size: number,
  x: number,
  y: number,
) {
  const key = "svg" + img + "_" + size + "_" + img.complete;

  if (!cachedGraphics[key]) {
    const can = document.createElement("canvas");
    can.width = size;
    can.height = size;

    const canctx = can.getContext("2d") as CanvasRenderingContext2D;

    const ratio = size / Math.max(img.width, img.height);
    const w = img.width * ratio;
    const h = img.height * ratio;
    canctx.drawImage(img, (size - w) / 2, (size - h) / 2, w, h);

    cachedGraphics[key] = can;
  }
  ctx.drawImage(
    cachedGraphics[key],
    Math.round(x - size / 2),
    Math.round(y - size / 2),
  );
}

export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  color: colorString,
  fontSize: number,
  x: number,
  y: number,
  left = false,
  borderWidth: number = 0,
) {
  const key =
    "text" +
    text +
    "_" +
    color +
    "_" +
    fontSize +
    "_" +
    left +
    "_" +
    borderWidth;

  if (!cachedGraphics[key]) {
    const can = document.createElement("canvas");
    can.width = fontSize * text.length + 4 + borderWidth * 2;
    can.height = fontSize + 4 + borderWidth * 2;
    const canctx = can.getContext("2d") as CanvasRenderingContext2D;
    canctx.fillStyle = color;
    canctx.textAlign = left ? "left" : "center";
    canctx.textBaseline = "middle";
    canctx.font = (fontSize > 20 ? "bolder " : "") + fontSize + "px monospace";
    if (borderWidth) {
      canctx.strokeStyle = color;
      canctx.lineWidth = borderWidth;
      canctx.strokeText(
        text,
        left ? 0 : can.width / 2,
        can.height / 2,
        can.width,
      );
    }
    canctx.fillText(text, left ? 0 : can.width / 2, can.height / 2, can.width);
    cachedGraphics[key] = can;
  }
  ctx.drawImage(
    cachedGraphics[key],
    left ? x : Math.round(x - cachedGraphics[key].width / 2),
    Math.round(y - cachedGraphics[key].height / 2),
  );
}

export const scoreDisplay = document.getElementById(
  "score",
) as HTMLButtonElement;
const menuLabel = document.getElementById("menuLabel") as HTMLButtonElement;

const emptyArray: number[] = [];
const redBorderDash = [5, 5];

export function getDashOffset(gameState: GameState) {
  if (isOptionOn("basic")) {
    return 0;
  }
  return Math.floor(((gameState.levelTime % 500) / 500) * 10) % 10;
}

let wakeLockRunning = false,
  wakeLockPending = false;

function askForWakeLock(gameState: GameState) {
  if (
    gameState === mainGameState &&
    isComputerControlled(gameState) &&
    !wakeLockPending &&
    !wakeLockRunning
  ) {
    wakeLockPending = true;
    try {
      navigator.wakeLock.request("screen").then((lock) => {
        wakeLockRunning = true;
        wakeLockPending = false;
        lock.addEventListener("release", () => {
          // the wake lock has been released
          wakeLockRunning = false;
        });
      });
    } catch (e) {
      console.warn("askForWakeLock error", e);
    }
  }
}

function updateMenuDisplay(gameState: GameState) {
  if (
    ["normal", "rogue"].includes(gameState.startParams.runType) &&
    (gameState.currentLevel || gameState.levelTime)
  ) {
    menuLabel.innerText = t("play.current_lvl", {
      level: gameState.currentLevel + 1,
      max: renderMaxLevel(gameState),
    });
  } else {
    menuLabel.innerText = t("play.menu_label");
  }
}
function updateScoreDisplay(gameState: GameState) {
  const catchRate = gameState.levelSpawnedCoins
    ? gameState.levelCaughtCoins / (gameState.levelSpawnedCoins || 1)
    : 1;
  if (gameState.startParams.runType === "level_editor_trial") {
    scoreDisplay.innerHTML = t("editor.leave_preview");
  } else if (gameState.startParams.runType === "level_preview_run") {
    scoreDisplay.innerHTML = t("play.close_modale_window_tooltip");
  } else {
    const misses = Math.max(
      0,
      gameState.levelMisses - gameState.perks.forgiving,
    );

    scoreDisplay.innerHTML =
      (isOptionOn("show_fps") || isComputerControlled(gameState)
        ? ` 
          <span class="${(Math.abs(lastMeasuredFPS - 60) < 2 && " ") || (Math.abs(lastMeasuredFPS - 60) < 10 && "good") || "bad"}">
            ${lastMeasuredFPS} FPS
        </span><span> / </span>
            `
        : "") +
      (isOptionOn("show_stats")
        ? ` 
        <span class="${(catchRate > catchRateBest / 100 && "great") || (catchRate > catchRateGood / 100 && "good") || ""}" data-tooltip="${t("play.stats.coins_catch_rate")}">
            ${Math.floor(catchRate * 100)}%
        </span><span> / </span>
        <span class="${(gameState.levelTime < levelTimeBest * 1000 && "great") || (gameState.levelTime < levelTimeGood * 1000 && "good") || ""}" data-tooltip="${t("play.stats.levelTime")}">
        ${Math.ceil(gameState.levelTime / 1000)}s 
        </span><span> / </span>  
        <span class="${(misses < missesBest && "great") || (misses < missesGood && "good") || ""}" data-tooltip="${t("play.stats.levelMisses")}">
        ${misses} M
        </span><span> / </span>
        `
        : "") +
      `<span class="score" data-tooltip="${
        ["normal", "rogue"].includes(gameState.startParams.runType)
          ? t("play.score_tooltip")
          : ""
      }">${formatFullNumber(gameState.score)} $</span>` +
      (gameState.startParams.runType === "rogue"
        ? `<span> / </span><span data-tooltip="${t("rogue.wallet_tooltip")}">🪙 ${gameState.startParams.testMode ? "∞" : formatFullNumber(gameState.rogueWallet)}</span>` +
          rogueHudExtras(gameState)
        : "");
  }

  scoreDisplay.classList[isComputerControlled(gameState) ? "add" : "remove"](
    "computer_controlled",
  );

  scoreDisplay.classList[
    gameState.lastScoreIncrease > gameState.levelTime - 500 ? "add" : "remove"
  ]("active");
}

const trueFalse = [true, false];
