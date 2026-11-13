// Part of the Breakout 71 rogue mode fork, a modified version of Breakout 71 by Renan LE CARO.
// Added in 2026. Licensed under the GNU AGPL v3, see the LICENSE file.
import {
  electrocuteMaxBricks,
  registerBallHit,
  shortestBrickPath,
} from "./electrocute";
import { bossRespawnMs } from "./rogue_generator";

const row = (s: string) => s.split("").map((c) => (c === "x" ? "#fff" : ""));

describe("electrocute", () => {
  it("max path grows with level", () => {
    expect([1, 2, 3].map(electrocuteMaxBricks)).toEqual([5, 7, 9]);
    expect(electrocuteMaxBricks(0)).toBe(0);
  });

  it("finds the shortest path through bricks", () => {
    // 4x4 grid, a row of bricks on the second line
    const bricks = [
      ...row("____"),
      ...row("xxxx"),
      ...row("____"),
      ...row("____"),
    ];
    expect(shortestBrickPath(bricks, 4, 4, 7, 5)).toEqual([4, 5, 6, 7]);
  });

  it("respects the length limit", () => {
    const bricks = [
      ...row("____"),
      ...row("xxxx"),
      ...row("____"),
      ...row("____"),
    ];
    expect(shortestBrickPath(bricks, 4, 4, 7, 3)).toBeNull();
  });

  it("does not cross empty cells or wrap around rows", () => {
    const bricks = [
      ...row("x__x"),
      ...row("____"),
      ...row("____"),
      ...row("____"),
    ];
    expect(shortestBrickPath(bricks, 4, 0, 3, 9)).toBeNull();
    // 3 and 4 are adjacent by index but not by position
    const wrap = [
      ...row("___x"),
      ...row("x___"),
      ...row("____"),
      ...row("____"),
    ];
    expect(shortestBrickPath(wrap, 4, 3, 4, 9)).toBeNull();
  });

  it("lets an already broken endpoint start the path", () => {
    const bricks = [
      ...row("_xx_"),
      ...row("____"),
      ...row("____"),
      ...row("____"),
    ];
    expect(shortestBrickPath(bricks, 4, 0, 2, 5)).toEqual([0, 1, 2]);
  });

  it("pairs hits that happen together, once", () => {
    const a = {},
      b = {};
    const balls = [a, b];
    expect(registerBallHit(a, balls, 1, 1000)).toBeNull();
    expect(registerBallHit(b, balls, 5, 1200)).toEqual({ a: 5, b: 1 });
    // used up
    expect(registerBallHit(a, balls, 1, 1250)).toBeNull();
  });

  it("ignores hits that are too far apart in time", () => {
    const a = {},
      b = {};
    registerBallHit(a, [a, b], 1, 1000);
    expect(registerBallHit(b, [a, b], 5, 1500)).toBeNull();
  });
});

describe("boss respawn", () => {
  it("is 10s at least and scales with brick count", () => {
    expect(bossRespawnMs(10)).toBe(10000);
    expect(bossRespawnMs(100)).toBe(25000);
  });
});

import { getPossibleUpgrades, makeEmptyPerksMap } from "./game_utils";
import { upgrades } from "./loadGameData";

describe("electrocute is a rogue only synergy", () => {
  const stateWith = (runType: string, perks: Record<string, number>) =>
    ({
      startParams: { runType, testMode: true },
      perks: { ...makeEmptyPerksMap(upgrades), ...perks },
    }) as any;
  const offered = (gs: any) =>
    getPossibleUpgrades(gs).some((u) => u.id === "electrocute");

  it("needs both multiball and ball attract ball", () => {
    expect(offered(stateWith("rogue", {}))).toBe(false);
    expect(offered(stateWith("rogue", { multiball: 1 }))).toBe(false);
    expect(offered(stateWith("rogue", { ball_attract_ball: 1 }))).toBe(false);
    expect(
      offered(stateWith("rogue", { multiball: 1, ball_attract_ball: 1 })),
    ).toBe(true);
  });
  it("is never offered outside rogue runs", () => {
    expect(
      offered(stateWith("normal", { multiball: 1, ball_attract_ball: 1 })),
    ).toBe(false);
  });
});
