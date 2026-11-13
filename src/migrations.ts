import { RunHistoryItem } from "./types";

import _appVersion from "./data/version.json";
import { generateSaveFileContent } from "./generateSaveFileContent";
import { toast } from "./toast";
import { isLevelLocked } from "./get_level_unlock_condition";
import { allLevels } from "./allLevels";

// The page will be reloaded if any migrations were run
let migrationsRun = 0;
function migrate(name: string, cb: () => void) {
  if (!localStorage.getItem(name)) {
    try {
      cb();
      console.debug("Ran migration : " + name);
      localStorage.setItem(name, "" + Date.now());
      migrationsRun++;
    } catch (e) {
      toast((e as Error).message);
      console.warn("Migration " + name + " failed : ", e);
    }
  }
}
function afterMigration() {
  // Avoid a boot loop by setting the hash before reloading
  // We can't set the query string as it is used for other things
  if (migrationsRun && !window.location.hash) {
    window.location.hash = "#reloadAfterMigration";
    window.location.reload();
  }
  if (!migrationsRun) {
    window.location.hash = "";
  }
}

migrate("save_data_before_upgrade_to_" + _appVersion, () => {
  localStorage.setItem(
    "recovery_data",
    JSON.stringify(generateSaveFileContent()),
  );
});

migrate("migrate_high_scores", () => {
  const old = localStorage.getItem("breakout-3-hs");
  if (old) {
    localStorage.setItem("breakout-3-hs-short", old);
    localStorage.removeItem("breakout-3-hs");
  }
});
migrate("recover_high_scores", () => {
  let runsHistory = JSON.parse(
    localStorage.getItem("breakout_71_runs_history") || "[]",
  ) as RunHistoryItem[];
  runsHistory.forEach((r) => {
    const currentHS = parseInt(
      localStorage.getItem("breakout-3-hs-" + (r.mode || "short")) || "0",
    );
    if (r.score > currentHS) {
      localStorage.setItem(
        "breakout-3-hs-" + (r.mode || "short"),
        "" + r.score,
      );
    }
  });
});

migrate("remove_long_and_creative_mode_data", () => {
  let runsHistory = JSON.parse(
    localStorage.getItem("breakout_71_runs_history") || "[]",
  ) as RunHistoryItem[];

  let cleaned = runsHistory.filter((r) => {
    if (!r.perks) return false;
    if ("mode" in r) {
      if (r.mode !== "short") {
        return false;
      }
    }
    return true;
  });
  if (cleaned.length !== runsHistory.length)
    localStorage.setItem("breakout_71_runs_history", JSON.stringify(cleaned));
});

migrate("compact_runs_data_again", () => {
  let runsHistory = JSON.parse(
    localStorage.getItem("breakout_71_runs_history") || "[]",
  ) as RunHistoryItem[];
  runsHistory = runsHistory.filter((r) => {
    if (!r.perks) return false;
    if ("mode" in r) {
      if (r.mode !== "short") {
        return false;
      }
      delete r.mode;
    }

    return true;
  });
  runsHistory.forEach((r) => {
    r.runTime = Math.round(r.runTime);
    if (r.perks) {
      for (let key in r.perks) {
        if (!r.perks[key]) {
          delete r.perks[key];
        }
      }
    }
    if ("best_level_score" in r) {
      delete r.best_level_score;
    }
    if ("worst_level_score" in r) {
      delete r.worst_level_score;
    }
  });

  localStorage.setItem("breakout_71_runs_history", JSON.stringify(runsHistory));
});

migrate("set_breakout_71_unlocked_levels" + _appVersion, () => {
  // We want to lock any level unlocked by an app upgrade too
  let runsHistory = JSON.parse(
    localStorage.getItem("breakout_71_runs_history") || "[]",
  ) as RunHistoryItem[];

  let breakout_71_unlocked_levels = JSON.parse(
    localStorage.getItem("breakout_71_unlocked_levels") || "[]",
  ) as string[];

  allLevels
    .filter((l) => !isLevelLocked(l, runsHistory))
    .forEach((l) => {
      if (!breakout_71_unlocked_levels.includes(l.name)) {
        breakout_71_unlocked_levels.push(l.name);
      }
    });
  localStorage.setItem(
    "breakout_71_unlocked_levels",
    JSON.stringify(breakout_71_unlocked_levels),
  );
});

migrate("clean_ls", () => {
  for (let key in localStorage) {
    try {
      JSON.parse(localStorage.getItem(key) || "null");
    } catch (e) {
      localStorage.removeItem(key);
      console.warn("Removed invalid key " + key, e);
    }
  }
});

migrate("set_user_id", () => {
  // Useful to identify a player when uploading his save file multiple times to a web service
  if (!localStorage.getItem("breakout_71_user_id")) {
    localStorage.setItem(
      "breakout_71_user_id",
      JSON.stringify(
        (self?.crypto?.randomUUID && self?.crypto?.randomUUID()) ||
          "user_" + Math.random(),
      ),
    );
  }
});

afterMigration();
