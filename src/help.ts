import { t } from "./i18n/i18n";
import { asyncAlert } from "./asyncAlert";
import { miniMarkDown } from "./pure_functions";
import { getIcon } from "./levelIcon";

export function helpMenuEntry() {
  return {
    icon: getIcon("icon:help"),
    text: t("help.title"),
    help: t("help.help"),
    async value() {
      await asyncAlert({
        id: "help",
        title: t("help.title"),
        allowClose: true,
        content: [miniMarkDown(t("help.content"))],
      });
    },
  };
}
