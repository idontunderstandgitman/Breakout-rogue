import conditions from "./unlockConditions.json";
import levels from "./levels.json";
import { rawUpgrades } from "../upgrades";
import { getLevelUnlockCondition } from "../get_level_unlock_condition";
import { PerkId, UnlockCondition, Upgrade } from "../types";
import { upgrades } from "../loadGameData";

describe("conditions", () => {
  it("defines conditions for existing levels only", () => {
    const conditionForMissingLevel = Object.keys(conditions).filter(
      (levelName) => !levels.find((l) => l.name === levelName),
    );
    expect(conditionForMissingLevel).toEqual([]);
  });
  it("defines conditions with existing upgrades only", () => {
    const existingIds: Set<string> = new Set(rawUpgrades.map((u) => u.id));
    const missing: Set<string> = new Set();
    Object.values(conditions).forEach(({ required, forbidden }) => {
      [...required, ...forbidden].forEach((id) => {
        if (!existingIds.has(id)) missing.add(id);
      });
    });

    expect([...missing]).toEqual([]);
  });

  it("required upgrade preconditions aren't in the forbidden ones", () => {
    const problems: String[] = [];
    Object.entries(conditions).forEach(
      ([levelName, { required, forbidden }]) => {
        forbidden.forEach((f) => {
          required.forEach((r) => {
            if (
              (upgrades.find((u) => u.id === r) as Upgrade).requires.includes(
                f as PerkId,
              )
            ) {
              problems.push(
                `Level ${levelName} requires ${r} but forbids its required perk ${f}`,
              );
            }
          });
        });
      },
    );

    expect(problems).toEqual([]);
  });

  it("defines conditions for all levels", () => {
    const toAdd: Record<string, UnlockCondition> = {};
    levels
      .filter((l) => !l.name.startsWith("icon:"))
      .forEach((l, li) => {
        if (l.name in conditions) return;
        toAdd[l.name] = getLevelUnlockCondition(li, upgrades);
      });
    if (Object.keys(toAdd).length) {
      console.debug(
        "Missing hardcoded conditions\n\n" +
          JSON.stringify(toAdd).slice(1, -1) +
          "\n\n",
      );
    }
    expect(Object.keys(toAdd)).toEqual([]);
  });
});
