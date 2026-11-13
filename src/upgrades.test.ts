import _rawLevelsList from "./data/levels.json";
import { rawUpgrades } from "./upgrades";

describe("rawUpgrades", () => {
  it("has an icon for each upgrade", () => {
    const missingIcon = rawUpgrades
      .map((u) => u.id)
      .filter((id) => !_rawLevelsList.find((l) => l.name === "icon:" + id));
    expect(missingIcon.join(", ")).toEqual("");
  });
  it("lists only existing upgrades as requires", () => {
    const invented: String[] = [];
    rawUpgrades.forEach((u) =>
      u.requires.forEach((req) => {
        if (!rawUpgrades.find((f) => f.id === req)) {
          invented.push(req);
        }
      }),
    );
    expect(invented).toEqual([]);
  });
});
