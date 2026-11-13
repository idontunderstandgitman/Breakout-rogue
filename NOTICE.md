# Notice of modifications

This is a modified version of **Breakout 71** by Renan LE CARO
(<https://gitlab.com/lecarore/breakout71>), licensed under the GNU Affero General Public License v3 (see `LICENSE`).
The modifications were made starting on **13 November 2026**, and this version is not the original game.
Source code of this version: <https://github.com/idontunderstandgitman/Breakout-rogue>

## What changed

- New **rogue mode** (endless rounds, generated maps, bedrock, wallet, shop, upgrade picks based on misses),
  boss rounds, curses, rerolls, the Electrocute upgrade and a rogue test mode. Rules are in `ROGUE_MODE.md`.
- Image import in the level editor (`src/image_to_level.ts`).
- New and changed files: `src/rogue.ts`, `src/rogue_generator.ts`, `src/electrocute.ts`, `src/image_to_level.ts` (+ tests),
  and edits in `src/gameStateMutators.ts`, `src/game.ts`, `src/game_utils.ts`, `src/openUpgradesPicker.ts`, `src/render.ts`,
  `src/upgrades.ts`, `src/types.d.ts`, `src/newGameState.ts`, `src/levelEditor.ts`, translations and level data.
- The in-game about menu now credits the original author and links to this source code.

Network use: if you run this game on a server, section 13 of the AGPL requires that users can get the corresponding source.
The in-game menu links to this repository for that reason. Keep that link pointing at the exact source you deploy.
