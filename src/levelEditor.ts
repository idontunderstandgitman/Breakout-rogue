import { transformRawLevel } from "./loadGameData";
import { t } from "./i18n/i18n";
import { getSettingValue, setSettingValue } from "./settings";
import { asyncAlert, closeModal } from "./asyncAlert";
import { Palette, RawLevel } from "./types";
import { getIcon, levelIconHTML } from "./levelIcon";

import _palette from "./data/palette.json";
import { mainGameState, restart } from "./game";
import { describeLevel, largestDivisorUnder5 } from "./game_utils";
import {
  automaticBackgroundColor,
  MAX_LEVEL_SIZE,
  MIN_LEVEL_SIZE,
} from "./pure_functions";
import { toast } from "./toast";
import { getCategoryName } from "./openUnlockedLevelsList";
import { levelCodeToRawLevel } from "./level_code_to_raw_level";
import { categoryDetails, categoryNames } from "./categoryNames";
import { imageFileToLevel } from "./image_to_level";

const palette = _palette as Palette;

export function levelEditorMenuEntry() {
  return {
    icon: getIcon("icon:editor"),
    text: t("editor.title"),
    help: t("editor.help"),
    async value() {
      openLevelEditorLevelsList().then();
    },
  };
}

function newLevelButton(rawList: RawLevel[]) {
  return {
    text: t("editor.new_level"),
    icon: getIcon("icon:editor"),
    value() {
      rawList.push({
        size: 6,
        bricks: "____________________________________",
        name: "custom level" + (rawList.length + 1),
        credit: "",
        category: "",
        author: getSettingValue("level-author", ""),
      });
      setSettingValue("custom_levels", rawList);
      editRawLevel(rawList.length - 1);
    },
  };
}

/** Opens the system file picker, resolves to undefined if nothing was chosen */
function pickImageFile(): Promise<File | undefined> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = "image/*";
    input.onchange = () => resolve(input.files?.[0]);
    input.oncancel = () => resolve(undefined);
    input.click();
  });
}

async function openLevelEditorLevelsList() {
  const rawList = getSettingValue("custom_levels", []) as RawLevel[];
  const customLevels = rawList.map(transformRawLevel);

  let choice = await asyncAlert({
    id: "editor",
    title: t("editor.title"),
    content: [
      newLevelButton(rawList),
      ...customLevels.map((l, li) => ({
        text: l.name,
        icon: levelIconHTML(l.bricks, l.size),
        value() {
          editRawLevel(li);
        },
        help: l.credit || describeLevel(l),
      })),

      {
        text: t("editor.import"),
        help: t("editor.import_instruction"),
        value() {
          const code = prompt(t("editor.import_instruction"))?.trim();
          if (code) {
            const lvl = levelCodeToRawLevel(code);
            if (lvl) {
              rawList.push(lvl);
              setSettingValue("custom_levels", rawList);
            }
          }
          openLevelEditorLevelsList();
        },
      },
      {
        text: t("editor.import_image"),
        help: t("editor.import_image_help"),
        async value() {
          const file = await pickImageFile();
          if (file) {
            const lvl = await imageFileToLevel(file).catch(() => undefined);
            if (!lvl || "error" in lvl) {
              toast(t("editor.import_image_bad_size"));
            } else {
              rawList.push({
                size: lvl.size,
                bricks: lvl.bricks,
                name: file.name.replace(/\.[^.]+$/, "").slice(0, 80) || "image",
                credit: "",
                category: "",
                author: getSettingValue("level-author", ""),
              });
              setSettingValue("custom_levels", rawList);
              editRawLevel(rawList.length - 1);
              return;
            }
          }
          openLevelEditorLevelsList();
        },
      },
    ],
  });
  if (typeof choice == "function") choice();
}

export async function editRawLevel(nth: number, color = "") {
  let rawList = getSettingValue("custom_levels", []) as RawLevel[];
  const level = rawList[nth];
  delete level.color;
  const bricks = level.bricks.split("");
  color ||= bricks.find((i) => i !== "_") || "W";

  let grid = "";
  for (let y = 0; y < level.size; y++) {
    grid +=
      '<div style="background: ' + automaticBackgroundColor(bricks) + ';">';
    for (let x = 0; x < level.size; x++) {
      const index = y * level.size + x;
      const c = bricks[index];
      const background = palette[c] ? "background: " + palette[c] + ";" : "";
      const checkerSize = largestDivisorUnder5(level.size);
      const checked =
        checkerSize > 1
          ? (Math.floor(x / checkerSize) + Math.floor(y / checkerSize)) % 2
          : x == (level.size - 1) / 2 || y == (level.size - 1) / 2;

      grid += `<span data-swipe="${index}" style="${background}" class="${checked ? "checked" : ""}">${c == "B" ? "💣" : ""}</span>`;
    }
    grid += "</div>";
  }

  const levelColors = new Set(bricks);
  levelColors.delete("_");
  levelColors.delete("B");

  let colorList =
    '<div class="palette">' +
    Object.entries(palette)
      .filter(([key, value]) => key !== "_")
      .map(
        ([key, value]) =>
          `<button data-resolve-to="set_color:${key}" 
        data-selected="${key == color}" style="background: ${value}" 
        ${levelColors.size < 5 || levelColors.has(key) || key === "B" ? "" : "disabled"}>${key == "B" ? "💣" : ""}</button>`,
      )
      .join("") +
    "</div>";

  const next = rawList[nth + 1];
  const previous = rawList[nth - 1];
  let painting = "";
  let painted: Set<number> = new Set();

  function paintBrick(el: Element) {
    const index = parseInt(el.getAttribute("data-swipe"));
    painted.add(index);
    el.style.background = palette[painting] || "";
    el.textContent = painting == "B" ? "💣" : "";
  }

  function handlePointerDown(e: MouseEvent) {
    if (!e.isPrimary) return;

    const el = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest("[data-swipe]");
    if (!el) return;
    const index = parseInt(el.getAttribute("data-swipe") as String);
    painting = bricks[index] === color ? "_" : color;
    paintBrick(el);
    e.stopPropagation();
  }
  function handlePointerMove(e: MouseEvent) {
    if (!painting) return;
    const el = document
      .elementFromPoint(e.clientX, e.clientY)
      ?.closest("[data-swipe]");

    if (!el) return;
    paintBrick(el);
    e.stopPropagation();
  }
  function handlePointerUp() {
    if (!painting) return;
    if (painted.size) {
      closeModal?.();
    } else {
      painting = "";
    }
  }
  function handleContextMenu(e: MouseEvent) {
    if (!painting) return;
    e.preventDefault();
  }
  const options = { capture: false, passive: false };

  document.addEventListener("pointerdown", handlePointerDown, options);
  document.addEventListener("pointermove", handlePointerMove, options);
  document.addEventListener("pointerup", handlePointerUp, options);
  document.addEventListener("contextmenu", handleContextMenu, options);

  function cleanup() {
    document.removeEventListener("pointerdown", handlePointerDown, options);
    document.removeEventListener("pointermove", handlePointerMove, options);
    document.removeEventListener("pointerup", handlePointerUp, options);
    document.removeEventListener("contextmenu", handleContextMenu, options);
  }
  const clicked = await asyncAlert<string | null | (() => void)>({
    title: `<span class="perk-title">
    <button ${previous ? 'data-resolve-to="previous"' : "disabled"} data-tooltip="${t("unlocks.previous")}">‹ </button>
    <span data-resolve-to="rename" data-tooltip="${t("editor.editing.rename")}">${level.name}</span>
    <button ${next ? 'data-resolve-to="next"' : "disabled"} data-tooltip="${t("unlocks.next")}">  ›</button></span> 
    `,
    content: [
      t("editor.editing.color"),
      colorList,
      t("editor.editing.help"),
      `<div class="gridEdit" style="--grid-size:${level.size}; ">${grid}</div>`,
      `<div class="editor-actions">
          <button data-resolve-to="size:+1" data-tooltip="${t("editor.editing.bigger")}" ${level.size >= MAX_LEVEL_SIZE ? "disabled" : ""}>+</button>
          <button data-resolve-to="size:-1" data-tooltip="${t("editor.editing.smaller")}" ${level.size <= MIN_LEVEL_SIZE ? "disabled" : ""}>-</button>
          <button data-resolve-to="move:-1:0" data-tooltip="${t("editor.editing.left")}">←</button>
          <button data-resolve-to="move:1:0" data-tooltip="${t("editor.editing.right")}">→</button>
          <button data-resolve-to="move:0:-1" data-tooltip="${t("editor.editing.up")}">↑</button>
          <button data-resolve-to="move:0:1" data-tooltip="${t("editor.editing.down")}">↓</button>
      </div>`,
      {
        icon: getIcon("icon:new_run"),
        text: t("editor.editing.play"),
        value: "play",
      },
      {
        text: t("editor.editing.rename"),
        value: "rename",
        help: level.name,
      },
      {
        text: t("editor.editing.credit"),
        value: "credit",
        help: level.credit,
      },
      {
        text: t("editor.editing.category"),
        value: "category",
        help: getCategoryName(level.category || ""),
      },
      {
        text: t("editor.editing.author"),
        value: "author",
        help: level.author,
      },
      {
        text: t("editor.editing.delete"),
        value: "delete",
      },
      {
        text: t("editor.editing.copy"),
        value: "copy",
        help: level.author
          ? t("editor.editing.copy_help")
          : t("editor.editing.author_required"),
        disabled: !level.author,
      },
      {
        text: t("editor.editing.show_code"),
        value: "show_code",
        help: level.author
          ? t("editor.editing.show_code_help")
          : t("editor.editing.author_required"),
        disabled: !level.author,
      },
      newLevelButton(rawList),
    ],
  });
  cleanup();
  if (painted.size && painting) {
    // swiped on the board
    painted.forEach((index) => {
      bricks[index] = painting;
    });
    level.bricks = bricks.join("");
  } else if (!clicked) return;

  if (typeof clicked === "function") {
    clicked();
    return;
  }
  if (typeof clicked === "string") {
    const [action, a, b] = clicked.split(":");
    if (action == "set_color") {
      color = a;
    }
    if (action == "size") {
      const newSize = level.size + parseInt(a);
      const newBricks = [];
      for (let y = 0; y < newSize; y++) {
        for (let x = 0; x < newSize; x++) {
          newBricks.push(
            (x < level.size && y < level.size && bricks[y * level.size + x]) ||
              "_",
          );
        }
      }
      level.size = newSize;
      level.bricks = newBricks.join("");
    }
    if (action == "move") {
      const dx = parseInt(a),
        dy = parseInt(b);
      const newBricks = [];
      for (let y = 0; y < level.size; y++) {
        for (let x = 0; x < level.size; x++) {
          const tx = x - dx;
          const ty = y - dy;
          if (tx < 0 || tx >= level.size || ty < 0 || ty >= level.size) {
            newBricks.push("_");
          } else {
            newBricks.push(bricks[ty * level.size + tx]);
          }
        }
      }
      level.bricks = newBricks.join("");
    }
    if (action === "play") {
      restart({
        runType: "level_editor_trial",
        level: transformRawLevel(level),
        levelEditorLevelIndex: nth,
        perks: {
          base_combo: 7,
        },
      });
      return;
    }
    if (action === "author") {
      const author = prompt(
        t("editor.editing.author_prompt"),
        level.author || "",
      );
      if (author !== null) {
        setSettingValue("level-author", author);
        level.author = author || "";
      }
    }
    if (action === "copy" || action === "show_code") {
      let text = "```\n" + JSON.stringify(level) + "\n```";

      if (action === "copy") {
        try {
          await navigator.clipboard.writeText(text);
          toast(t("editor.editing.copied"));
        } catch (e) {
          if ("message" in e) {
            toast(e.message);
          }
        }
      } else {
        await asyncAlert({
          id: "show_code",
          title: t("editor.editing.show_code"),
          content: [
            `
          <pre style="white-space: break-spaces; word-break: break-all">${text}</pre>
          `,
          ],
        });
      }
      // return
    }
    if (action === "rename") {
      const name = prompt(t("editor.editing.rename_prompt"), level.name);
      if (name) {
        level.name = name;
      }
    }
    if (action === "credit") {
      const credit = prompt(
        t("editor.editing.credit_prompt"),
        level.credit || "",
      );
      if (credit !== "null") {
        level.credit = credit || "";
      }
    }

    if (action === "category") {
      const choices = [];
      for (let key in categoryNames) {
        choices.push({
          value: key,
          text: categoryNames[key](),
          help: categoryDetails[key](),
        });
      }

      const category = await asyncAlert({
        id: "editor_category_prompt",
        title: t("editor.editing.category_prompt"),
        content: choices,
      });

      if (category) {
        level.category = category;
      }
    }

    if (action === "delete") {
      const confirm = await asyncAlert({
        id: "editing_delete_confirm",
        title: t("editor.editing.delete_confirm"),

        content: [
          `<div class="full-width-icon">${levelIconHTML(transformRawLevel(level).bricks, level.size, 350)}</div>`,
          {
            text: t("editor.editing.delete_yes"),
            value: true,
          },
          {
            text: t("editor.editing.delete_no"),
            value: false,
          },
        ],
      });
      if (confirm) {
        rawList = rawList.filter((l, li) => li !== nth);
        setSettingValue("custom_levels", rawList);
        openLevelEditorLevelsList();
        return;
      }
    }

    if (action == "next" && next) return editRawLevel(rawList.indexOf(next));
    if (action == "previous" && previous)
      return editRawLevel(rawList.indexOf(previous));
  }

  setSettingValue("custom_levels", rawList);
  editRawLevel(nth, color);
}

export function closeEditorTrialRun() {
  editRawLevel(mainGameState.startParams.levelEditorLevelIndex || 0);
  restart({
    runType: "normal",
  });
}
