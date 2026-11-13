let div = document.createElement("div");
div.classList = "hidden toast";
document.body.appendChild(div);
let timeout: NodeJS.Timeout | undefined;
export function toast(html: string, className = "") {
  clearToasts();
  div.classList = "toast visible " + className;
  div.innerHTML = html;
  timeout = setTimeout(clearToasts, 1500);
}

export function clearToasts() {
  if (timeout) {
    clearTimeout(timeout);
    timeout = undefined;
  }
  div.classList = "hidden toast";
}
