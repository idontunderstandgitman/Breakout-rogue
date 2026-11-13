import { GameState } from "./types";
import { getIcon } from "./levelIcon";
import { getUpgradeHelp } from "./openUpgradesPicker";
import { t } from "./i18n/i18n";
import {
  escapeAttribute,
  getPossibleUpgrades,
  upgradeLevelAndMaxDisplay,
} from "./game_utils";

export function pickedUpgradesHTMl(gameState: GameState) {
  const upgradesList = getPossibleUpgrades(gameState)
    .filter((u) => gameState.perks[u.id])
    .map((u) => {
      const newMax = Math.max(0, u.max + gameState.perks.limitless);

      const state = (gameState.perks[u.id] && 1) || (!newMax && 2) || 3;
      const tooltip = escapeAttribute(u.fullHelp(gameState.perks[u.id] || 1));
      return {
        state,
        html: `
        <div class="upgrade ${["??", "used", "banned", "free"][state]}">
            ${getIcon("icon:" + u.id)}
            <p data-tooltip="${tooltip}"
            data-help-content="${tooltip}"
            >
            <strong>${u.name}</strong>
            ${upgradeLevelAndMaxDisplay(u, gameState)} 
            ${getUpgradeHelp(u, gameState)} 
          
          </p>  
        </div>
        `,
      };
    })
    .sort((a, b) => a.state - b.state)
    .map((a) => a.html);

  return ` <p>${t("score_panel.upgrades_picked")}</p>` + upgradesList.join("");
}
