import { moveLevel, resizeLevel, setBrick } from "./levels_editor_util";

const baseLevel = {
  name: "",
  bricks: "AAAA",
  size: 2,
  svg: null,
  color: "",
};
describe("resizeLevel", () => {
  it("should expand levels", () => {
    expect(resizeLevel(baseLevel, 1)).toStrictEqual({
      bricks: "AA_AA____",
      size: 3,
    });
  });
  it("should shrink levels", () => {
    expect(resizeLevel(baseLevel, -1)).toStrictEqual({ bricks: "A", size: 1 });
  });
});

describe("moveLevel", () => {
  it("should do nothing when coords are 0/0", () => {
    expect(moveLevel(baseLevel, 0, 0)).toStrictEqual({ bricks: "AAAA" });
  });
  it("should move right", () => {
    expect(moveLevel(baseLevel, 1, 0)).toStrictEqual({ bricks: "_A_A" });
  });
  it("should move left", () => {
    expect(moveLevel(baseLevel, -1, 0)).toStrictEqual({ bricks: "A_A_" });
  });
  it("should move up", () => {
    expect(moveLevel(baseLevel, 0, -1)).toStrictEqual({ bricks: "AA__" });
  });
  it("should move down", () => {
    expect(moveLevel(baseLevel, 0, 1)).toStrictEqual({ bricks: "__AA" });
  });
});

describe("setBrick", () => {
  it("should set the first brick", () => {
    expect(setBrick(baseLevel, 0, "C")).toStrictEqual({ bricks: "CAAA" });
  });
  it("should any brick", () => {
    expect(setBrick(baseLevel, 2, "C")).toStrictEqual({ bricks: "AACA" });
  });
});
