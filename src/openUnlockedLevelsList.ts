import { getSettingValue, setSettingValue } from "./settings";
import { allLevels } from "./allLevels";
import { getIcon } from "./levelIcon";
import { asyncAlert } from "./asyncAlert";
import { Level } from "./types";
import { t } from "./i18n/i18n";
import { openLevelDetails } from "./openLevelDetails";
import { categoryNames } from "./categoryNames";
import { getUnlockedLevelList } from "./unlocked_level_list";

type mapper = (a: { l: Level; unlockedBefore: Set<string> }) => {
  label: string;
  sort: string;
};

export function getCategoryName(s: string) {
  return (categoryNames[s] || categoryNames["stills"])();
}
export const sortMethods: {
  value: string;
  text: () => string;
  getVal: mapper;
}[] = [
  {
    value: "unlocked",
    text: () => t("unlocks.sort_unlocked"),
    getVal({ l, unlockedBefore }) {
      if (unlockedBefore.has(l.name)) {
        return { label: t("unlocks.level_unlocked"), sort: "a" };
      } else {
        return { label: t("unlocks.level_locked"), sort: "z" };
      }
    },
  },
  {
    value: "category",
    text: () => t("unlocks.sort_category"),
    getVal({ l }) {
      const label = getCategoryName(l.category);
      return { label, sort: label };
    },
  },
  {
    value: "author",
    text: () => t("unlocks.sort_author"),
    getVal({ l }) {
      return { label: l.author || "Renan", sort: l.author || "Renan" };
    },
  },
  {
    value: "size",
    text: () => t("unlocks.sort_size"),
    getVal({ l }) {
      return {
        label: l.size + "×" + l.size,
        sort: ("0000" + l.size).slice(-3),
      };
    },
  },
  {
    value: "bricks",
    text: () => t("unlocks.sort_bricks"),
    getVal({ l }) {
      const count = l.bricks.filter((c) => c && c !== "black").length;
      return {
        label: t("unlocks.sort_bricks_label", { count }),
        sort: ("0000" + count).slice(-3),
      };
    },
  },
  {
    value: "bombs",
    text: () => t("unlocks.sort_bombs"),
    getVal({ l }) {
      const count = l.bricks.filter((c) => c === "black").length;
      return {
        label:
          (count === 0 && t("unlocks.sort_bombs_label_0")) ||
          (count === 1 && t("unlocks.sort_bombs_label_1")) ||
          t("unlocks.sort_bombs_label", { count }),
        sort: ("0000" + count).slice(-3),
      };
    },
  },
  {
    value: "colors",
    text: () => t("unlocks.sort_colors"),
    getVal({ l }) {
      const count = new Set(l.bricks.filter((c) => c && c !== "black")).size;
      return {
        label:
          (count === 1 && t("unlocks.sort_colors_label_1")) ||
          t("unlocks.sort_colors_label", { count }),
        sort: ("0000" + count).slice(-3),
      };
    },
  },
];

export function getSortedLevelsList() {
  let criteria = getSettingValue("sort-criteria", "unlocked");
  const getVal =
    sortMethods.find((s) => s.value === criteria)?.getVal ||
    sortMethods[0].getVal;

  const unlockedBefore = getUnlockedLevelList();
  let unlockedCount = 0;
  const sorted = allLevels
    .map((l, li) => ({ l, li, ...getVal({ l, unlockedBefore }) }))
    .sort((a, b) => a.sort.localeCompare(b.sort) || a.li - b.li);

  const grouped: { label: string; levels: Level[] }[] = [];
  sorted.forEach(({ l, li, label }) => {
    unlockedCount += unlockedBefore.has(l.name) ? 1 : 0;

    if (grouped[grouped.length - 1]?.label === label) {
      grouped[grouped.length - 1].levels.push(l);
    } else {
      grouped.push({ label, levels: [l] });
    }
  });
  return {
    sorted: sorted.map((l) => l.l),
    grouped: grouped,
    unlockedCount,
    criteria,
  };
}

export async function openUnlockedLevelsList() {
  const actions = [];

  const { unlockedCount, grouped, sorted, criteria } = getSortedLevelsList();
  grouped.forEach(({ label, levels }) => {
    actions.push(`<h2>${label}</h2>`);
    levels.forEach((l) => {
      actions.push({
        value: l,
        icon: getIcon(l.name, l.size),
        className: "level choice no-border",
        tooltip: l.name,
      });
    });
  });

  const choice = await asyncAlert<Level>({
    title: t("unlocks.levels"),
    content: [
      t("unlocks.level", {
        unlocked: unlockedCount,
        out_of: sorted.length,
      }),
      ...sortMethods.map((s) => ({
        value: s.value,
        text: s.text(),
        className: criteria == s.value ? "highlight" : "",
      })),
      ...actions,
    ],
    allowClose: true,
    className: "levels-list",
  });

  if (typeof choice === "string") {
    setSettingValue("sort-criteria", choice);
    openUnlockedLevelsList();
  } else if (choice) {
    await openLevelDetails(choice);
  }
}
