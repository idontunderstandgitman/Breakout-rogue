import { isOptionOn } from "./options";
import { getCurrentLang } from "./i18n/i18n";

export function shortenBigNumber(n: number) {
  let minMul = 6;
  if (n < 1000 * minMul || !isOptionOn("short_numbers")) return "" + n;
  if (n > 1000000000 * minMul) return Math.floor(n / 1000000000) + "B";
  if (n > 1000000 * minMul) return Math.floor(n / 1000000) + "M";
  return Math.floor(n / 1000) + "k";
}

let locale: string | undefined, formatter: Intl.NumberFormat | undefined;
export function formatFullNumber(score: number | bigint) {
  if (locale !== getCurrentLang()) {
    formatter = new Intl.NumberFormat(getCurrentLang(), {});
    locale = getCurrentLang();
  }
  return formatter?.format(score);
}
