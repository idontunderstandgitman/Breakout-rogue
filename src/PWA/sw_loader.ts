if (
  "serviceWorker" in navigator &&
  window.location.href.endsWith("/index.html?isPWA=true")
) {
  // @ts-ignore
  const url = new URL("sw-b71.js", import.meta.url);
  navigator.serviceWorker.register(url);
}
