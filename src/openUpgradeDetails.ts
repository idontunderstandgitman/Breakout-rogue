import { PerkId, Upgrade } from "./types";
import { upgrades } from "./loadGameData";
import { getSettingValue, getTotalScore, setSettingValue } from "./settings";
import { asyncAlert } from "./asyncAlert";
import { miniMarkDown } from "./pure_functions";
import { t } from "./i18n/i18n";
import { getPerkAnimation } from "./gameAnimation";
import { getUpgradeHelp, getUpgradeTooltip } from "./openUpgradesPicker";
import { getCheckboxIcon } from "./levelIcon";
import { mainGameState } from "./game";
import { synergies } from "./synergies";
import { incompatibilities } from "./incompatibilities";

export async function openUpgradeDetails(id: PerkId, onClose: () => void) {
  const u = upgrades.find((u) => u.id === id) as Upgrade;
  const { name } = u;

  const ts = getTotalScore();

  const free = upgrades
    .filter(({ threshold }) => ts >= threshold)
    .map((u) => u.id);
  const currentIndex = free.indexOf(id);
  const next = free[currentIndex + 1];
  const previous = free[currentIndex - 1];

  const required = upgrades
    .filter((r) => u.requires.includes(r.id) && r.id !== u.id)
    .map((u) => u.name);

  const allowedInGame = getSettingValue("offer-upgrade-" + id, true);
  const tooFarInGame =
    mainGameState.currentLevel > 0 &&
    mainGameState.startParams.runType === "normal";

  const synergiesPerks = upgrades
    .filter((c) => synergies[u.id]?.includes(c.id))
    .map((u) => u.name)
    .join(", ");

  const incompatible = incompatibilities
    .filter((l) => l.includes(u.id))
    .flat()
    .filter((id) => id != u.id);
  const incompatiblePerks = upgrades
    .filter((c) => incompatible.includes(c.id))
    .map((u) => u.name)
    .join(", ");

  const action = await asyncAlert<string>({
    title: `<span class="perk-title">
    <button ${previous ? 'data-resolve-to="previous"' : "disabled"} data-tooltip="${t("unlocks.previous")}">‹ </button>
    <span>${name}</span>
    <button ${next ? 'data-resolve-to="next"' : "disabled"} data-tooltip="${t("unlocks.next")}">  ›</button></span> 
    `,
    content: [
      getPerkAnimation(id),
      getUpgradeHelp(u, undefined),
      miniMarkDown(getUpgradeTooltip(u, undefined)),
      (required.length === 1 && t("unlocks.requires_one", { required })) ||
        (required.length &&
          t("unlocks.requires", { required: required.join(", ") })) ||
        "",
      {
        icon: getCheckboxIcon(allowedInGame),
        text: t("unlocks.upgrade_choice_perk"),
        help:
          (tooFarInGame &&
            t("unlocks.include_in_unlock_not_during_gameplay")) ||
          t("unlocks.upgrade_choice_perk_help"),
        value: "toggle-offer-upgrade",
        disabled: tooFarInGame,
      },

      synergiesPerks &&
        t("unlocks.upgrade_synergies", { list: synergiesPerks }),
      incompatiblePerks &&
        t("unlocks.upgrade_incompatibilities", {
          list: incompatiblePerks,
        }),

      "id:" + id,
    ],
    allowClose: true,
  });
  if (!action) return onClose();

  switch (action) {
    case "previous":
      if (previous) {
        openUpgradeDetails(previous, onClose);
        return;
      }
      break;
    case "next":
      if (next) {
        openUpgradeDetails(next, onClose);
        return;
      }
      break;

    case "toggle-offer-upgrade":
      setSettingValue("offer-upgrade-" + id, !allowedInGame);
      break;
  }
  return openUpgradeDetails(id, onClose);
}
