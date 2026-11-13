// Settings

import { toast } from "./toast";

let cachedSettings: { [key: string]: unknown } = {};
let warnedUserAboutLSIssue = false;

try {
  for (let key in localStorage) {
    try {
      cachedSettings[key] = JSON.parse(localStorage.getItem(key) || "null");
    } catch (e) {
      if (!warnedUserAboutLSIssue) {
        warnedUserAboutLSIssue = true;
        toast(`Storage issue : ${(e as Error)?.message}`);
      }
      console.warn("Reading " + key, e);
    }
  }
} catch (e) {
  console.warn(e);
}

export function getSettingValue<T>(key: string, defaultValue: T) {
  return (cachedSettings[key] as T) ?? defaultValue;
}

//  We avoid using localstorage synchronously for perf reasons
let needsSaving: Set<string> = new Set();

export function setSettingValue<T>(key: string, value: T) {
  needsSaving.add(key);
  cachedSettings[key] = value;
}

export function commitSettingsChangesToLocalStorage() {
  try {
    for (let key of needsSaving) {
      localStorage.setItem(key, JSON.stringify(cachedSettings[key]));
    }
    needsSaving.clear();
  } catch (e) {
    if (!warnedUserAboutLSIssue) {
      warnedUserAboutLSIssue = true;
      toast(`Storage issue : ${(e as Error)?.message}`);
    }
    console.warn(e);
  }
}

setInterval(() => commitSettingsChangesToLocalStorage(), 500);

export function getTotalScore() {
  return getSettingValue("breakout_71_total_score", 0);
}

export function getCurrentMaxCoins() {
  return Math.pow(2, getSettingValue("max_coins", 1)) * 200;
}

export function getCurrentMaxParticles() {
  return getCurrentMaxCoins();
}

export function cycleMaxCoins() {
  setSettingValue("max_coins", (getSettingValue("max_coins", 2) + 1) % 7);
}

let asked = false;

export async function askForPersistentStorage() {
  if (asked) return;
  asked = true;
  if (!navigator.storage) return;
  if (!navigator.storage.persist) return;
  if (!navigator.storage.persisted) return;
  if (await navigator.storage.persisted()) {
    return;
  }
  const persistent = await navigator.storage.persist();
  if (!persistent) {
    console.warn("No storage granted");
  }
}
