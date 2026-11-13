import { GameState } from "./types";
import { getClosestBall } from "./game_utils";
import { hashCode } from "./getLevelBackground";
import { clamp, forEachLiveOne } from "./pure_functions";
import { gameOver } from "./gameOver";

export function computerControl(gameState: GameState) {
  let speed = 1;
  let targetX = gameState.puckPosition;
  const ball = getClosestBall(
    gameState,
    gameState.puckPosition,
    gameState.gameZoneHeight,
  );
  if (!ball) return;

  const rng = Math.abs(
    hashCode(
      gameState.runStatistics.puck_bounces + "random_seed_string_5666548541",
    ) % 100,
  );
  let puckOffset = ((rng - 50) / 100) * gameState.puckWidth;

  if (
    gameState.perks.left_is_lava ||
    gameState.perks.side_kick ||
    gameState.perks.wrap_right ||
    gameState.perks.pierce_right
  ) {
    puckOffset = -gameState.puckWidth / 2.2;
  }
  if (
    gameState.perks.right_is_lava ||
    gameState.perks.side_flip ||
    gameState.perks.wrap_left ||
    gameState.perks.pierce_left ||
    gameState.perks.pierce_top
  ) {
    puckOffset = gameState.puckWidth / 2.2;
  }
  if (gameState.perks.nbricks) {
    puckOffset *= 0.1;
  }
  if (gameState.perks.three_cushion) {
    puckOffset = (gameState.puckWidth / 2.2) * (rng > 50 ? 1 : -1);
  }

  const ballGettingCloser =
    ball.y > gameState.gameZoneHeight / 2 && ball.vy > 0;

  if (
    gameState.perks.superhot ||
    ballGettingCloser ||
    gameState.perks.paddle_up_combo
  ) {
    targetX = ball.x + puckOffset;
    if (gameState.perks.extra_life) speed = -1;
    if (gameState.perks.yoyo) speed = 0.5;
    if (gameState.perks.paddle_up_combo) {
      targetX += ball.vx * 5;
    }
  } else {
    let coinsTotalX = 0,
      coinsCount = 0;
    forEachLiveOne(gameState.coins, (c) => {
      if (c.vy > 0 && c.y > gameState.gameZoneHeight / 2) {
        coinsTotalX += c.x;
        coinsCount++;
      }
    });
    if (coinsCount) {
      targetX = coinsTotalX / coinsCount;
      if (
        gameState.perks.asceticism ||
        gameState.perks.fountain_toss ||
        gameState.perks.buoy
      )
        speed = -1;
    } else {
      targetX = gameState.canvasWidth / 2;
    }
  }

  if (gameState.perks.top_is_lava) speed *= 1.3;

  gameState.puckPosition +=
    clamp((targetX - gameState.puckPosition) / 5, -10, 10) * speed;
  if (gameState.levelTime > 30000) {
    gameOver(
      gameState,
      "30s_automatic_preview_reset",
      "this_message_should_never_be_displayed",
    );
  }
}
