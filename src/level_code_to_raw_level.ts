import { toast } from "./toast";
import { palette } from "./loadGameData";
import { MAX_LEVEL_SIZE, MIN_LEVEL_SIZE } from "./pure_functions";
import { categoryNames } from "./categoryNames";

export function levelCodeToRawLevel(code: string) {
  try {
    // Removed surrounding code block and spaces
    code = code.replace(/^(`|\s)+|(`|\s)+$/gi, "");
    // New format
    const parsed = JSON.parse(code);

    if (
      parsed.size < MIN_LEVEL_SIZE ||
      parsed.size > MAX_LEVEL_SIZE ||
      parseInt("" + parsed.size) !== parsed.size ||
      parsed.bricks.length !== parsed.size * parsed.size
    ) {
      return toast("Invalid size");
    }
    if (
      parsed.bricks.split("").findIndex((b: string) => !(b in palette)) !==
        -1 ||
      new Set(
        parsed.bricks.split("").filter((b: string) => b !== "_" && b !== "B"),
      ).size > 5
    ) {
      return toast("Invalid bricks");
    }

    parsed.category ||= "stills";
    if (!(parsed.category in categoryNames)) return toast("Invalid category");

    function getAndCheck(
      fieldName: string,
      minLength: number,
      maxLength: number,
    ) {
      const raw = parsed[fieldName].trim();
      if (raw.length < minLength) {
        throw new Error(fieldName + " is too short, minimum " + minLength);
      }
      if (raw.length > maxLength) {
        throw new Error(fieldName + " is too long, maximum " + maxLength);
      }
      return raw;
    }

    return {
      size: parsed.size,
      bricks: parsed.bricks,
      category: parsed.category,
      name: getAndCheck("name", 1, 80),
      author: getAndCheck("author", 1, 80),
      credit: getAndCheck("credit", 0, 500),
    };
  } catch {}
  // legacy format
  let [name, credit] = code.match(/\[([^\]]+)]/gi) || ["", ""];
  let bricks = code.split(name)[1].split(credit)[0].replace(/\s/gi, "");
  name = name.slice(1, -1);
  credit = credit.slice(1, -1);
  name ||= "Imported on " + new Date().toISOString().slice(0, 10);
  credit ||= "";
  const size = Math.sqrt(bricks.length);
  if (
    Math.floor(size) === size &&
    size >= MIN_LEVEL_SIZE &&
    size <= MAX_LEVEL_SIZE
  )
    return {
      size,
      bricks,
      name,
      credit,
      author: "",
      category: "",
    };
  console.warn("Invalid level", {
    code,
    name,
    credit,
    bricks,
    size,
  });
}
