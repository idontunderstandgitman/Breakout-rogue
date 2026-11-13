export function generateSaveFileContent() {
  const localStorageContent: Record<string, string> = {};

  for (let i = 0; i < localStorage.length; i++) {
    const key = localStorage.key(i) as string;
    if (
      [
        // Avoid including recovery info in the recovery info
        "recovery_data",
        // This autosave is rough, better not keep it across versions
        "autosave",
      ].includes(key)
    )
      continue;
    try {
      const value = localStorage.getItem(key) as string;
      localStorageContent[key] = JSON.parse(value);
    } catch (e) {}
  }
  return localStorageContent;
}
