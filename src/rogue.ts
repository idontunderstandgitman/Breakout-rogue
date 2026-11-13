// Part of the Breakout 71 rogue mode fork, a modified version of Breakout 71 by Renan LE CARO.
// Added in 2026. Licensed under the GNU AGPL v3, see the LICENSE file.
import { GameState, Level, PerkId, RawLevel } from "./types";
import { upgrades } from "./loadGameData";
import { allLevels } from "./allLevels";
import { transformRawLevel } from "./loadGameData";
import { getHistory } from "./gameOver";
import { getSettingValue } from "./settings";
import { getUnlockedLevelList } from "./unlocked_level_list";
import { isLevelLocked } from "./get_level_unlock_condition";
import { requiredAsyncAlert } from "./asyncAlert";
import { getIcon } from "./levelIcon";
import { t } from "./i18n/i18n";
import {
  ROGUE_MAX_HANDMADE_SIZE,
  bedrockCountFor,
  generateBrickLetters,
  mixSeed,
  mulberry32,
  placeBedrock,
  roundsBeforeWithSameSize,
  rogueMapSize,
  ROGUE_BOSS_REWARD_CHOICES,
  ROGUE_BOSS_REWARD_PICKS,
  ROGUE_CURSE_REWARD_UNITS,
  ROGUE_CURSE_ROUNDS,
  ROGUE_MAX_LIVES,
  ROGUE_SHIELD_ROUNDS,
  ShopItem,
  activeCurseIds,
  bossTimeLimitMs,
  curseOffer,
  isBossRound,
  rerollPrice,
  shopSelection,
  shopUnitPrice,
} from "./rogue_generator";
import { toast } from "./toast";

function handmadeLevelsOfSize(size: number) {
  const unlockedBefore = getUnlockedLevelList();
  const history = getHistory();
  return allLevels
    .filter((l) => l.size === size)
    .filter((l) => unlockedBefore.has(l.name) || !isLevelLocked(l, history))
    .filter((l) => getSettingValue("offer-level-" + l.name, true));
}

function pickHandmadeLevel(seed: number, round: number): Level | undefined {
  const size = rogueMapSize(round);
  if (size > ROGUE_MAX_HANDMADE_SIZE) return undefined;
  const pool = handmadeLevelsOfSize(size);
  // Same shuffle for every round of that size, so no map comes twice in a run
  const order = [...pool]
    .map((l) => ({
      l,
      k: mulberry32(mixSeed(seed, size, l.name.length, hashName(l.name)))(),
    }))
    .sort((a, b) => a.k - b.k)
    .map((o) => o.l);
  return order[roundsBeforeWithSameSize(round)] as Level | undefined;
}

function hashName(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) | 0;
  return h;
}

/** Builds the map of a 0 based round. Same seed and round always give the same map. */
export function getRogueLevel(gameState: GameState, round: number): Level {
  const seed = gameState.rogueSeed;
  const size = rogueMapSize(round);
  const rng = mulberry32(mixSeed(seed, round, size));

  let base = pickHandmadeLevel(seed, round);
  const generated = !base;
  if (!base) {
    const letters = generateBrickLetters(size, round, rng);
    base = {
      ...transformRawLevel({
        name: "Rogue " + (round + 1),
        size,
        bricks: letters.join(""),
      } as RawLevel),
      required: [],
      forbidden: [],
      minScore: 0,
      author: "",
      category: "rogue",
    } as Level;
  }

  const wanted = bedrockCountFor(round, size);
  let { bedrock, clearedBricks } = placeBedrock(
    base.bricks,
    size,
    wanted,
    rng,
    generated,
  );
  // Some hand made pictures have no room for bedrock next to their bricks.
  // Rather than skipping it, let it take the place of a brick.
  if (wanted > 0 && !bedrock.some(Boolean)) {
    ({ bedrock, clearedBricks } = placeBedrock(
      base.bricks,
      size,
      wanted,
      rng,
      true,
    ));
  }
  const cleared = new Set(clearedBricks);
  const bricks = base.bricks.map((b, i) => (cleared.has(i) ? "" : b));
  return {
    ...base,
    bricks,
    bricksCount: bricks.filter(Boolean).length,
    bedrock: bedrock.some(Boolean) ? bedrock : undefined,
  };
}

type CurseId = keyof GameState["rogueCurses"];

function curseName(id: CurseId) {
  if (id === "wrong_angle") return t("rogue.curse.wrong_angle.name");
  if (id === "slow_paddle") return t("rogue.curse.slow_paddle.name");
  return t("rogue.curse.retro.name");
}

function curseHelp(id: CurseId) {
  if (id === "wrong_angle") return t("rogue.curse.wrong_angle.help");
  if (id === "slow_paddle") return t("rogue.curse.slow_paddle.help");
  return t("rogue.curse.retro.help");
}

function ownedUpgrades(gameState: GameState) {
  // Extra lives are bought, not picked, and can not be taken back
  return upgrades.filter(
    (u) => u.id !== "extra_life" && (gameState.perks[u.id] || 0) > 0,
  );
}

/** Lets the player drop one owned upgrade completely. Resolves to false if cancelled. */
async function askUpgradeToRemove(gameState: GameState) {
  const owned = ownedUpgrades(gameState);
  const choice = await requiredAsyncAlert<string>({
    title: t("rogue.shop.remove_title"),
    content: [
      t("rogue.shop.remove_intro"),
      ...owned.map((u) => ({
        value: "remove:" + u.id,
        icon: getIcon("icon:" + u.id),
        text: u.name + " " + gameState.perks[u.id],
        help: "",
        actionLabel: t("rogue.shop.remove_action"),
      })),
      {
        value: "cancel",
        icon: getIcon("icon:new_run"),
        text: t("rogue.shop.remove_cancel"),
        help: "",
      },
    ],
  });
  const value = String(choice);
  if (!value.startsWith("remove:")) return false;
  const id = value.slice("remove:".length) as PerkId;
  if (!(id in gameState.perks)) return false;
  gameState.perks[id] = 0;
  return true;
}

/** Items that can not be offered any more this run */
function soldOutItems(gameState: GameState) {
  return (gameState.rogueLivesBought || 0) >= ROGUE_MAX_LIVES
    ? ["extra_life"]
    : [];
}

/** Boss rounds : judged when the round ends. Reward only if the last brick fell in time. */
export function rogueRoundResult(gameState: GameState) {
  if (!isBossRound(gameState.currentLevel)) return;
  const limit = bossTimeLimitMs(gameState.level.bricksCount);
  // winAt is set 5 seconds after the last brick, to let coins fall
  const clearedAt = gameState.winAt
    ? gameState.winAt - 5000
    : gameState.levelTime;
  if (clearedAt <= limit) {
    gameState.rogueSavedPicks =
      (gameState.rogueSavedPicks || 0) + ROGUE_BOSS_REWARD_PICKS;
    gameState.rogueExtraUpgradeChoices =
      (gameState.rogueExtraUpgradeChoices || 0) + ROGUE_BOSS_REWARD_CHOICES;
    toast(
      t("rogue.boss.won", {
        picks: ROGUE_BOSS_REWARD_PICKS,
        choices: ROGUE_BOSS_REWARD_CHOICES,
      }),
    );
  }
  // Too slow : the toast was already shown when the timer ran out
}

function formatTime(ms: number) {
  const total = Math.max(0, Math.ceil(ms / 1000));
  return Math.floor(total / 60) + ":" + String(total % 60).padStart(2, "0");
}

/** Boss timer and active curses, shown next to the wallet */
export function rogueHudExtras(gameState: GameState) {
  let html = "";
  if (isBossRound(gameState.currentLevel)) {
    const left =
      bossTimeLimitMs(gameState.level.bricksCount) - gameState.levelTime;
    html += `<span> / </span><span data-tooltip="${t("rogue.boss.tooltip")}">${
      left > 0 ? "⏱ " + formatTime(left) : "⏱ 0:00"
    }</span>`;
  }
  const curses = activeCurseIds(gameState.rogueCurses);
  if (curses.length) {
    html += `<span> / </span><span data-tooltip="${curses
      .map((id) => curseName(id) + " (" + gameState.rogueCurses[id] + ")")
      .join(", ")}">☠ ${curses.length}</span>`;
  }
  return html;
}

/** Shop open between rounds : spend caught coins on power-ups for the next rounds */
export async function openRogueShop(gameState: GameState) {
  const bricks = gameState.level.bricksCount;
  const unit = shopUnitPrice(bricks);
  const round = gameState.currentLevel;
  const bonus = gameState.rogueExtraShopOptions;
  // The bonus options bought earlier are used up by this visit
  gameState.rogueExtraShopOptions = 0;
  let rerolls = 0;
  const select = () =>
    shopSelection(
      bricks,
      gameState.rogueSeed,
      round,
      bonus,
      soldOutItems(gameState),
      rerolls,
    );
  let items = select();
  let curseTaken = false;
  const curseId = curseOffer(gameState.rogueSeed, round, gameState.rogueCurses);

  const label = (item: ShopItem) => {
    switch (item.kind) {
      case "combo":
        return t("rogue.shop.head_start", { combo: item.combo });
      case "bedrock_shield":
        return t("rogue.shop.bedrock_shield", { rounds: ROGUE_SHIELD_ROUNDS });
      case "remove_upgrade":
        return t("rogue.shop.remove_upgrade");
      case "owned_bias":
        return t("rogue.shop.owned_bias");
      case "extra_life":
        return t("rogue.shop.extra_life", {
          left: ROGUE_MAX_LIVES - (gameState.rogueLivesBought || 0),
        });
      default:
        return t("rogue.shop.extra_choice");
    }
  };
  const help = (item: ShopItem) => {
    switch (item.kind) {
      case "combo":
        return t("rogue.shop.price", { price: item.price });
      case "bedrock_shield":
        return t("rogue.shop.price_shield", { price: item.price });
      case "remove_upgrade":
        return t("rogue.shop.price_remove", { price: item.price });
      case "owned_bias":
        return t("rogue.shop.price_owned_bias", { price: item.price });
      case "extra_life":
        return t("rogue.shop.price_life", { price: item.price });
      default:
        return t("rogue.shop.price_choice", { price: item.price });
    }
  };
  const icon = (item: ShopItem) =>
    getIcon(
      {
        combo: "icon:hot_start",
        bedrock_shield: "icon:forgiving",
        remove_upgrade: "icon:new_run",
        owned_bias: "icon:limitless",
        extra_life: "icon:extra_life",
        extra_choice: "icon:one_more_choice",
      }[item.kind],
    );

  while (true) {
    const rerollCost = rerollPrice(bricks, rerolls);
    const choice = await requiredAsyncAlert<string>({
      title: t("rogue.shop.title", { round: gameState.currentLevel + 1 }),
      content: [
        t("rogue.shop.intro", {
          wallet: gameState.rogueWallet,
          bought: gameState.rogueHeadStart,
        }),
        ...items.map((item) => ({
          value: "buy:" + item.id,
          icon: icon(item),
          text: label(item),
          help: help(item),
          disabled:
            gameState.rogueWallet < item.price ||
            (item.kind === "bedrock_shield" &&
              gameState.rogueBedrockShield >= ROGUE_SHIELD_ROUNDS) ||
            (item.kind === "owned_bias" && gameState.rogueOwnedBias) ||
            (item.kind === "remove_upgrade" &&
              ownedUpgrades(gameState).length === 0) ||
            (item.kind === "extra_life" &&
              (gameState.rogueLivesBought || 0) >= ROGUE_MAX_LIVES),
        })),
        {
          value: "reroll",
          icon: getIcon("icon:reroll"),
          text: t("rogue.shop.reroll"),
          help: t("rogue.shop.reroll_help", { price: rerollCost }),
          disabled: gameState.rogueWallet < rerollCost,
        },
        curseId &&
        !curseTaken &&
        !activeCurseIds(gameState.rogueCurses).includes(curseId) &&
        activeCurseIds(gameState.rogueCurses).length < 2
          ? {
              value: "curse:" + curseId,
              icon: getIcon("icon:left_is_lava"),
              text: curseName(curseId),
              help: t("rogue.shop.curse_help", {
                text: curseHelp(curseId),
                rounds: ROGUE_CURSE_ROUNDS,
                reward: ROGUE_CURSE_REWARD_UNITS[curseId] * unit,
              }),
              actionLabel: t("rogue.shop.curse_take"),
            }
          : "",
        {
          value: "continue",
          icon: getIcon("icon:new_run"),
          text: t("rogue.shop.continue"),
          help: "",
        },
      ],
    });
    const value = String(choice);
    if (value === "reroll") {
      if (gameState.rogueWallet < rerollCost) continue;
      gameState.rogueWallet -= rerollCost;
      rerolls++;
      items = select();
      continue;
    }
    if (value.startsWith("curse:")) {
      const id = value.slice("curse:".length) as keyof GameState["rogueCurses"];
      if (id !== curseId || activeCurseIds(gameState.rogueCurses).length >= 2)
        continue;
      gameState.rogueCurses = {
        ...gameState.rogueCurses,
        [id]: ROGUE_CURSE_ROUNDS,
      };
      gameState.rogueWallet += ROGUE_CURSE_REWARD_UNITS[id] * unit;
      // The offer is gone for this visit
      curseTaken = true;
      continue;
    }
    if (!value.startsWith("buy:")) return;
    const item = items.find((i) => "buy:" + i.id === value);
    if (!item || gameState.rogueWallet < item.price) continue;
    if (
      item.kind === "bedrock_shield" &&
      gameState.rogueBedrockShield >= ROGUE_SHIELD_ROUNDS
    )
      continue;
    if (item.kind === "owned_bias" && gameState.rogueOwnedBias) continue;
    if (
      item.kind === "extra_life" &&
      (gameState.rogueLivesBought || 0) >= ROGUE_MAX_LIVES
    )
      continue;
    if (item.kind === "remove_upgrade") {
      // Pay only once an upgrade was really removed
      const removed = await askUpgradeToRemove(gameState);
      if (!removed) continue;
      gameState.rogueWallet -= item.price;
      continue;
    }
    gameState.rogueWallet -= item.price;
    if (item.kind === "owned_bias") gameState.rogueOwnedBias = true;
    else if (item.kind === "combo") gameState.rogueHeadStart += item.combo;
    else if (item.kind === "bedrock_shield")
      gameState.rogueBedrockShield = ROGUE_SHIELD_ROUNDS;
    else if (item.kind === "extra_life") {
      gameState.rogueLivesBought = (gameState.rogueLivesBought || 0) + 1;
      gameState.perks.extra_life += 1;
    } else {
      gameState.rogueExtraUpgradeChoices++;
      gameState.rogueExtraShopOptions++;
    }
  }
}
