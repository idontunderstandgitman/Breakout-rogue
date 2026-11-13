import { getHistory } from "./gameOver";
import { appVersion, upgrades } from "./loadGameData";
import { t } from "./i18n/i18n";
import { asyncAlert } from "./asyncAlert";
import { getSettingValue, setSettingValue } from "./settings";
import { getCheckboxIcon, getIcon } from "./levelIcon";

import { formatFullNumber } from "./format_number";

export function runHistoryViewerMenuEntry() {
  const history = getHistory();

  return [
    history.length && {
      icon: getIcon("icon:history"),
      text: t("history.title"),
      help: t("history.help", { count: history.length }),
      value: viewHistory,
    },
  ];
}

async function viewHistory() {
  const history = getHistory();
  let sort = 0;
  let sortDir = -1;
  let columns = [
    {
      label: t("history.columns.started"),
      field: (r) => r.started,
      render(v) {
        return new Date(v).toISOString().slice(0, 10);
      },
    },
    {
      label: t("history.columns.mainPerkId"),
      field: (r) =>
        upgrades.find((u) => u.id === r.mainPerkId)?.name ||
        r.mainPerkId ||
        "-",
    },
    {
      label: t("history.columns.score"),
      field: (r) => r.score,
      render(v): string {
        return formatFullNumber(v) + " $";
      },
    },
    ...upgrades
      .filter((u) => history.find((r) => r.perks[u.id]))
      .map((u) => ({
        label: getIcon("icon:" + u.id),
        tooltip: u.name,
        field: (r) => r.perks?.[u.id] || 0,
        render(v) {
          if (!v) return "-";
          return v;
        },
      })),
  ];
  while (true) {
    const hasCurrentVersion = history.find((r) => r.appVersion === appVersion);
    const hasPastVersion = history.find((r) => r.appVersion !== appVersion);

    const header = columns
      .map(
        (c, ci) =>
          `<th data-tooltip="${c.tooltip || ""}" data-resolve-to="sort:${ci}">${c.label}</th>`,
      )
      .join("");
    const toString = (v) => v.toString();
    const tbody = history
      .filter(
        (r) =>
          !hasCurrentVersion ||
          r.appVersion === appVersion ||
          getSettingValue("show_old_versions_in_stats", false),
      )
      .sort(
        (a, b) => sortDir * (columns[sort].field(a) - columns[sort].field(b)),
      )
      .map(
        (h) =>
          "<tr>" +
          columns
            .map((c) => {
              const value = c.field(h) ?? 0;
              const render = c.render || toString;
              return "<td>" + render(value) + "</td>";
            })
            .join("") +
          "</tr>",
      )
      .join("");

    const result = await asyncAlert({
      id: "history",
      title: t("history.title"),
      className: "history",
      content: [
        `
<table>
<thead><tr style="white-space: nowrap">${header}</tr></thead>
<tbody>${tbody}</tbody>
</table>
                    `,
        hasPastVersion &&
          hasCurrentVersion && {
            icon: getCheckboxIcon(
              getSettingValue("show_old_versions_in_stats", false),
            ),
            value: "toggle",
            text: t("history.include_past_versions"),
          },
      ],
    });
    if (!result) return;
    if (result.startsWith("sort:")) {
      const newSort = parseInt(result.split(":")[1]);
      if (newSort == sort) {
        sortDir *= -1;
      } else {
        sortDir = -1;
        sort = newSort;
      }
    }
    if (result === "toggle") {
      setSettingValue(
        "show_old_versions_in_stats",
        !getSettingValue("show_old_versions_in_stats", false),
      );
    }
  }
}
