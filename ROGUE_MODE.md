# Rogue mode

Endless alternative to the 7 level campaign. Start it from the main menu ("Rogue mode").

## Rules

- **Endless**: every round is a new map, the run only ends when you lose.
- **Maps**: rounds 1 and 2 are 8x8, then every third map is one size larger.
  Hand made levels (unlocked ones only) are used up to 24x24, never twice in a run.
  When none is available, and always past 24x24, the map is generated.
  Generated maps keep growing every third round up to 30x30, then only get harder (more colors, bombs, bedrock).
- **Bedrock**: unbreakable cells, from the third map on. Balls always bounce on it, pierce perks and explosions ignore it,
  and a shot that touches bedrock but no brick counts as a miss (when the ball is back at the paddle) unless the bedrock shield power-up is active. Placement guarantees that every brick can still be reached.
  A size x size map gets at most size / 2 bedrock cells: normal rounds stop at size / 4, boss rounds at size / 2.
- **Upgrades**: no medals. Picks after a round depend on missed shots: 0 misses = 3 picks, 1-2 = 2, 3 or more = 1.
  `forgiving` still removes misses. The number of choices per pick is unchanged.
- **Saving picks**: the upgrade picker has a "Skip and save N pick(s)" button. Unused picks are added to the next round's picks.
- **Wallet and shop**: every caught coin also goes in a run wallet. Before every second round (3rd, 5th, 7th ...) a shop opens.
  It shows 3 power-ups picked (seeded) from a pool of 8:
  - +5 / +15 / +40 combo at the start of the next round.
  - Bedrock shield: bedrock bounces are not misses for 2 rounds.
  - +1 upgrade choice: +1 offer in the next upgrade picker and +1 power-up in the next shop (that shop shows 4).
  - Remove an upgrade: pick any owned upgrade to drop completely. You only pay if you remove one.
  - Owned upgrades: at least half of the offers in the next upgrade picker are upgrades you already own.
  - Extra life: very expensive, at most 3 per run, can not be restored. It is not offered as an upgrade in rogue mode.
  Prices are multiples of half the brick count of the next map (see `shopPool`).
  Spending never lowers the score, high score or lifetime total.
- **Reroll**: the shop and the upgrade picker both have a reroll button. It costs 3 price units and doubles each time in the same shop or picker.
- **Curses**: every shop also offers one curse (not counted in the 3 power-ups). Taking it pays coins right away and lasts 3 rounds. At most 2 are active at once.
  - Crooked launch: the ball leaves the paddle up to about 8 degrees off (`ROGUE_WRONG_ANGLE`).
  - Slow paddle: the paddle follows the pointer at a limited speed. Three stages (`ROGUE_SLOW_PADDLE_STAGES`), all offered together when this curse comes up: the slower, the bigger the reward (6 / 10 / 15 price units). Stage 3 is the original, hardest one.
  - Retro controls: on touch screens the left and right halves of the screen are two buttons (`ROGUE_RETRO_PADDLE_SPEED`). The round starts on the first press (no countdown), and lifting a finger only stops the paddle, it does not pause the game. Nothing changes with mouse or arrow keys.
- **Boss rounds**: every 10th round. Same map size schedule as other rounds, but twice the bedrock and a timer
  (`ROGUE_BOSS_BASE_MS` + `ROGUE_BOSS_MS_PER_BRICK` per brick). Clearing the last brick in time gives +3 upgrade picks and +2 choices in the next picker. The round continues after the timer, there is just no reward (losing a boss costs nothing else).
  - Broken bricks come back after `bossRespawnMs` (at least 10 s, 0.25 s per brick on bigger maps). To win, every brick must be gone at the same time. Bombs and bedrock never come back.
  - A cell only pays coins the first time it is broken; respawned bricks give no gold.
  - When the timer runs out nothing respawns anymore and a "too slow" message is shown once.
- **Electrocute** (synergy, rogue only): offered in the upgrade picker only when you own both Multiball and Ball attract ball. When two balls hit bricks within 300 ms of each other and the bricks are connected (4 neighbours), a current runs between them and every brick on the shortest path takes 1 damage. Longest path (endpoints included): 5 / 7 / 9 bricks at level 1 / 2 / 3. Code in `src/electrocute.ts`.
- **Rogue test mode** (menu entry "Rogue test mode"): for trying things out. Coins are unlimited (the HUD shows ∞),
  every upgrade is offered in the picker (locked ones too, minus `chill` and `extra_levels`) and you can pick as many as you want
  until you press "Done picking". Skip to the next round with the N key or the "Skip level" menu entry.
  Nothing is saved : no lifetime score, high score, best round, autosave or upgrade statistics. It is `testMode` in `RunParams`.
- **Kept between runs**: the lifetime total score still unlocks upgrades exactly like in campaign mode.
  Rogue runs have their own high score and best round. They are not added to the campaign run history,
  so they can't unlock campaign levels.
- `extra_levels` and `chill` are not offered in rogue mode and can't be the starting perk.

## Where to tune

All constants are at the top of `src/rogue_generator.ts`: start size, size cap, when bedrock starts,
shop frequency, shop tiers, speed cap. `rogueUpgradePicks` and `shopUnitPrice` hold the pick and price formulas.

## Code map

- `rogue_generator.ts`: pure logic (progression, procedural maps, bedrock placement), unit tested.
- `rogue.ts`: level selection and shop UI.
- Bedrock lives in a separate `gameState.bedrock` layer, not in `bricks`, so every brick counting loop ignores it.
  Collisions go through `hitsSomething` and a dedicated branch in the ball collision code.
