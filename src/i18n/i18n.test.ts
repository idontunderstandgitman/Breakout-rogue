import { languages } from "./i18n";
import en from "./en.json";

const englishTranslation = en as Record<string, string>;

describe("translation quality checks", () => {
  it("no html, links, puck", () => {
    const badKeys: String[] = [];
    for (let { value: languageCode, strings } of languages) {
      const translations = strings as Record<string, string>;
      for (let key in translations) {
        if (
          translations[key].match(
            /<|>|http|\bpuck\b|\bpalet\b|퍽|шайба|冰球|rondelle|pagaie/gi,
          )
        ) {
          badKeys.push(languageCode + ":" + key + " : " + translations[key]);
        }
      }
    }
    expect(badKeys).toEqual([]);
  });
  it("reasonable number of braces", () => {
    const badKeys: String[] = [];
    for (let { value: languageCode, strings } of languages) {
      const translations = strings as Record<string, string>;
      for (let key in translations) {
        if (
          translations[key].split("{").length !==
          translations[key].split("}").length
        ) {
          badKeys.push(languageCode + ":" + key + " : " + translations[key]);
        }
      }
    }
    expect(badKeys).toEqual([]);
  });
  it("only variable names used somewhere in english translation will work ", () => {
    let knownVariableNames = new Set<string>();
    for (let key in englishTranslation) {
      englishTranslation[key]
        .match(/\{\{[^}]+\}\}/gi)
        ?.forEach((name) => knownVariableNames.add(name));
    }
    const badKeys: String[] = [];
    for (let { value: languageCode, strings } of languages) {
      const translations = strings as Record<string, string>;
      for (let key in translations) {
        if (
          translations[key]
            .match(/\{\{[^}]+\}\}/gi)
            ?.find((name: string) => !knownVariableNames.has(name))
        ) {
          badKeys.push(languageCode + ":" + key + " : " + translations[key]);
        }
      }
    }
    expect(badKeys).toEqual([]);
  });
  it("all keys are set in english, except maybe verbose_description", () => {
    const badKeys = Object.keys(englishTranslation).filter(
      (k) => !englishTranslation[k] && !k.includes("verbose_description"),
    );
    expect(badKeys).toEqual([]);
  });
});
