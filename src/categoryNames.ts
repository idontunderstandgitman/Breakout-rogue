import { t } from "./i18n/i18n";

export const categoryNames: Record<string, () => string> = {
  stills: () => t("unlocks.levels_categories.stills"),
  animals: () => t("unlocks.levels_categories.animals"),
  symbols: () => t("unlocks.levels_categories.symbols"),
  landscapes: () => t("unlocks.levels_categories.landscapes"),
  games: () => t("unlocks.levels_categories.games"),
  abstract: () => t("unlocks.levels_categories.abstract"),
  flags: () => t("unlocks.levels_categories.flags"),
  portraits: () => t("unlocks.levels_categories.portraits"),
};

export const categoryDetails: Record<string, () => string> = {
  stills: () => t("unlocks.levels_categories_rules.stills"),
  animals: () => t("unlocks.levels_categories_rules.animals"),
  symbols: () => t("unlocks.levels_categories_rules.symbols"),
  landscapes: () => t("unlocks.levels_categories_rules.landscapes"),
  games: () => t("unlocks.levels_categories_rules.games"),
  abstract: () => t("unlocks.levels_categories_rules.abstract"),
  flags: () => t("unlocks.levels_categories_rules.flags"),
  portraits: () => t("unlocks.levels_categories_rules.portraits"),
};
