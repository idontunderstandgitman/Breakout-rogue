import { synergies } from "./synergies";
import { PerkId } from "./types";
import { upgrades } from "./loadGameData";
import { categories } from "./upgrades";

describe("synergies", () => {
  it("never lists an upgrade twice in the same list", () => {
    const problems = Object.entries(synergies)
      .filter((s) => s[1].length !== new Set(s[1]).size)
      .map((s) => s[0]);

    expect(problems).toEqual([]);
  });

  it("offers a synnergy for each combo perk", () => {
    const problems: Array<PerkId> = [];
    upgrades.forEach((u) => {
      if (u.category == categories.combo && !synergies[u.id]?.length) {
        problems.push(u.id);
      }
    });
    expect(problems).toEqual([]);
  });
});
