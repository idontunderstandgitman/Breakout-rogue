import { rawUpgrades } from "./upgrades";
import { options } from "./options";

export type colorString = string;

export type RawLevel = {
  name: string;
  size: number;
  bricks: string;
  credit?: string;
  author?: string;
  category?: string;
};
export type Level = {
  name: string;
  size: number;
  bricks: colorString[];
  bricksCount: number;
  svg: string;
  color: string;
  sortKey: number;
  credit?: string;
  // unlock conditions
  required: PerkId[];
  forbidden: PerkId[];
  minScore: number;
  author: string;
  category: string;
  // Rogue mode only : unbreakable cells (same indexing as bricks)
  bedrock?: boolean[];
};

export type Palette = { [k: string]: string };

export type Upgrade = {
  threshold: number;
  id: PerkId;
  name: string;
  category: number;
  max: number;
  hardLimit: number;
  help: (lvl: number) => string;
  fullHelp: (lvl: number) => string;
  requires: PerkId[];
};

export type PerkId = (typeof rawUpgrades)[number]["id"];

declare global {
  interface Window {
    webkitAudioContext?: typeof AudioContext;
    backButtonCaptured?: () => boolean;
    gameState?: GameState;
  }

  interface Document {
    webkitFullscreenEnabled?: boolean;
    webkitCancelFullScreen?: () => void;
  }

  interface Element {
    webkitRequestFullscreen: typeof Element.requestFullscreen;
  }

  interface MediaStream {
    // https://devdoc.net/web/developer.mozilla.org/en-US/docs/Web/API/CanvasCaptureMediaStream.html
    // On firefox, the capture stream has the requestFrame option
    // instead of the track, go figure
    requestFrame?: () => void;
  }
}

export type BallLike = {
  x: number;
  y: number;
  vx?: number;
  vy?: number;
};

export type Coin = {
  points: number;
  color: colorString;
  x: number;
  y: number;
  size: number;
  previousX: number;
  previousY: number;
  vx: number;
  vy: number;
  // sx: number;
  // sy: number;
  a: number;
  sa: number;
  weight: number;
  destroyed?: boolean;
  collidedLastFrame?: boolean;
  metamorphosisPoints: number;
  floatingTime: number;
};

// represents brick damage to apply at a later time, for the bomb delay
export type DelayedDmg = {
  destroyed?: boolean;
  index: number;
  damage: number;
  time: number;
  ballIndex: number;
};
export type Ball = {
  x: number;
  previousX: number;
  y: number;
  previousY: number;
  vx: number;
  vy: number;
  previousVX: number;
  previousVY: number;
  hasGravity: boolean;
  // sx: number;
  // sy: number;
  // Ability to pierce N HP
  piercePoints: number;
  // Any bounce counts, even if brick resisted the hit
  hitSinceBounce: number;
  // Brick was really broken ,but could have been respawned as a bomb
  brokenSinceBounce: number;
  brokenSinceWallOrPaddleBounce: number;
  sidesHitsSinceBounce: number;
  softBrushUsesSinceBounce: number;
  topHitsSinceBounce: number;
  // Rogue mode : the ball touched bedrock since it last left the paddle
  bedrockHitSinceBounce?: boolean;
  wrapsSinceBounce: number;
  // At the time of the last paddle bounce, there were fewer bricks on screen than there are balls.
  // In this case, we can't expect that the user will hit something every time
  bouncedToEmptyLevel: boolean;
  sapperUses: number;
  destroyed?: boolean;
  tail: ReusableArray<BallTailParticle>;
};

interface BallTailParticle {
  destroyed?: boolean;
  x: number;
  y: number;
  vx: number;
  vy: number;
}

interface BaseFlash {
  time: number;
  color: colorString;
  duration: number;
  size: number;
  destroyed?: boolean;
  x: number;
  y: number;
}

interface ParticleFlash extends BaseFlash {
  // type: "particle";
  vx: number;
  vy: number;
  ethereal: boolean;
}

interface TextFlash extends BaseFlash {
  // type: "text";
  text: string;
  vx: number;
  vy: number;
}

interface LightFlash extends BaseFlash {
  // type: "ball";
}

export type RunStats = {
  started: number;
  levelsPlayed: number;
  runTime: number;
  coins_spawned: number;
  score: number;
  bricks_broken: number;
  misses: number;
  balls_lost: number;
  puck_bounces: number;
  wall_bounces: number;
  upgrades_picked: number;
  max_combo: number;
};

export type PerksMap = {
  [k in PerkId]: number;
};

export type ReusableArray<T> = {
  // All items below that index should not be destroyed
  indexMin: number;
  total: number;
  list: Array<T>;
};

export type RunHistoryItem = RunStats & {
  perks?: Partial<PerksMap>;
  appVersion?: string;
};
export type GameState = {
  // Width of the canvas element in pixels
  canvasWidth: number;
  // Height of the canvas element in pixels
  canvasHeight: number;
  // Distance between the left of the canvas and the left of the leftmost brick, in pixels
  offsetX: number;
  // Distance between the left of the canvas and the left border of the game area, in pixels.
  // Can be 0 when no border is shown
  offsetXRoundedDown: number;
  // Width of the bricks area, in pixels
  gameZoneWidth: number;
  // Width of the game area between the left and right borders, in pixels
  gameZoneWidthRoundedUp: number;
  // Height of the play area, between the top of the canvas and the bottom of the puck.
  // Does not include the finger zone on mobile.
  gameZoneHeight: number;
  // Size of one brick in pixels
  brickWidth: number;
  // Size of the current level's grid
  gridSize: number;
  // 0 based index of the current level in the run (level X / 7)
  currentLevel: number;
  upgradesOfferedFor: number;

  // 10 levels selected randomly at start for the run
  runLevels: Level[];
  // Current level displayed
  level: Level;
  // Width of the puck in pixels, changed by some perks and resizes
  puckWidth: number;
  // perks the user currently has
  perks: PerksMap;
  // Base speed of the ball in pixels/tick
  baseSpeed: number;
  // Score multiplier
  combo: number;
  // Combo at the start of the tick
  lastCombo: number;
  // Whether the game is running or paused
  running: boolean;
  isGameOver: boolean;
  ballStickToPuck: boolean;
  // Whether the game should be re-rendered once even if not running
  needsRender: boolean;
  // Position of the center of the puck on the canvas in pixels, from the left of the canvas.
  puckPosition: number;
  lastPuckPosition: number;
  // Will be set if the game is about to be paused. Game pause is delayed by a few milliseconds if you pause a few times in a run,
  // to avoid abuse of the "release to pause" feature on mobile.
  pauseTimeout: NodeJS.Timeout | null;

  // Current run score
  score: number;
  // levelTime of the last time the score increase, to render the score differently
  lastScoreIncrease: number;
  levelCaughtCoins: number;
  levelBrickBroken: number;
  // levelTime of the last explosion, for screen shake
  lastExplosion: number;
  lastBrickBroken: number;
  // High score at the beginning of the run
  highScore: number;
  // Balls currently in game, game over if it's empty
  balls: Ball[];
  // Color of the balls, can be changed by some perks
  ballsColor: colorString;
  // Array of bricks to display. 'black' means bomb. '' means no brick.
  bricks: colorString[];
  // Number of times a brick has been hit already
  brickHP: number[];

  particles: ReusableArray<ParticleFlash>;
  texts: ReusableArray<TextFlash>;
  lights: ReusableArray<LightFlash>;
  coins: ReusableArray<Coin>;
  delayedDmgs: ReusableArray<DelayedDmg>;

  // Bricks that should respawn destroyed
  respawns: ReusableArray<{
    index: number;
    color: string;
    time: number;
    destroyed?: boolean;
  }>;

  levelStartScore: number;
  levelMisses: number;
  levelSpawnedCoins: number;
  levelLostCoins: number;

  puckColor: colorString;
  ballSize: number;
  coinSize: number;
  puckHeight: number;
  pauseUsesDuringRun: number;
  keyboardPuckSpeed: number;
  lastTick: number;
  lastTickDown: number;
  runStatistics: RunStats;
  offersCount: Partial<{ [k in PerkId]: number }>;
  levelTime: number;
  lastPuckMove: number;
  lastZenComboIncrease: number;
  winAt: number;
  /** Boss rounds : cells already broken once (respawned bricks pay no coins) */
  bossBroken: boolean[];
  /** Boss rounds : timer ran out, bricks stop coming back */
  bossExpired: boolean;
  levelWallBounces: number;
  autoCleanUses: number;
  aboutToPlaySound: {
    wallBeep: { vol: number; x: number };
    comboIncreaseMaybe: { vol: number; x: number };
    comboDecrease: { vol: number; x: number };
    coinBounce: { vol: number; x: number };
    explode: { vol: number; x: number };
    lifeLost: { vol: number; x: number };
    coinCatch: { vol: number; x: number };
    plouf: { vol: number; x: number };
    colorChange: { vol: number; x: number };
  };
  rerolls: number;
  // Rogue mode : unbreakable cells of the current level, same indexing as bricks
  bedrock: boolean[];
  // Rogue mode : coins available in the shop, separate from the score
  rogueWallet: number;
  // Rogue mode : combo bought in the shop, added at the start of the next round then consumed
  rogueHeadStart: number;
  // Rogue mode : rounds left (including the current one) where bedrock bounces are not misses
  rogueBedrockShield: number;
  // Rogue mode : extra offers in the next upgrade picker, then consumed
  rogueExtraUpgradeChoices: number;
  // Rogue mode : extra offers in the next shop, then consumed
  rogueExtraShopOptions: number;
  // Rogue mode : upgrade picks skipped earlier, added to the next round's picks
  rogueSavedPicks: number;
  // Rogue mode : half of the offers of the next upgrade picker are upgrades you already own
  rogueOwnedBias: boolean;
  // Rogue mode : rounds left (including the current one) for each curse
  rogueCurses: Record<"wrong_angle" | "slow_paddle" | "retro", number>;
  // Rogue mode : extra lives bought this run, they can not be restored
  rogueLivesBought: number;
  // Where the pointer wants the paddle, used when the paddle has a speed limit
  puckTarget: number;
  // Retro curse on touch screens : -1 left button held, 1 right button held
  retroDirection: -1 | 0 | 1;
  // Rogue mode : makes maps reproducible for a given run
  rogueSeed: number;
  startParams: RunParams;
  startCountDown: number;
  // usefull to avoid autosave conflicts
  gameVersion: string;
};

export type RunParams = {
  level?: Level;
  levelToAvoid?: string;
  perkToAvoid?: PerkId;
  mainPerkId?: PerkId;
  perks?: Partial<PerksMap>;
  levelEditorLevelIndex?: number;
  runType: RunType;
  // Rogue mode without limits for testing : free money, every upgrade, skip level, nothing saved
  testMode?: boolean;
};
export type OptionDef = {
  default: boolean;
  name: string;
  help: string;
};
export type OptionId = keyof typeof options;

export type UnlockCondition = {
  required: PerkId[];
  forbidden: PerkId[];
  minScore: number;
};

export type RunType =
  | "normal"
  | "rogue"
  | "creative"
  | "level_editor_trial"
  | "level_preview_run"
  | "stress"
  | "autoplay"
  | "animated_perk_preview";
export type HitDirection = "top" | "left" | "right" | "bottom" | "corner";
