import { t } from "./i18n/i18n";
import { hideAnyTooltip } from "./tooltip";
import { isOptionOn } from "./options";
import { menuClick } from "./menuSound";

export let alertsOpen = 0,
  closeModal: null | (() => void) = null;

export type AsyncAlertAction<t> = {
  text?: string;
  tooltip?: string;
  link?: string;
  value?: t;
  help?: string;
  disabled?: boolean;
  icon?: string;
  className?: string;
  actionLabel?: string;
};

const popupWrap = document.getElementById("popup") as HTMLDivElement;
const closeModaleButton = document.getElementById(
  "close-modale",
) as HTMLButtonElement;

closeModaleButton.addEventListener("click", (e) => {
  e.preventDefault();
  if (closeModal) closeModal();
});

closeModaleButton.title = t("play.close_modale_window_tooltip");

let lastClickedItemIndex = -1;

export function requiredAsyncAlert<t>(p: {
  title?: string;
  content: (string | false | AsyncAlertAction<t>)[];
  className?: string;
}): Promise<t> {
  return asyncAlert({ ...p, allowClose: false }) as Promise<t>;
}

export async function asyncAlert<t>({
  title,
  id,
  content = [],
  allowClose = true,
  className = "",
}: {
  title?: string;
  id?: string;
  content: (string | false | AsyncAlertAction<t>)[];
  allowClose?: boolean;
  className?: string;
}): Promise<t | void> {
  if (document.exitPointerLock) {
    document.exitPointerLock();
  }
  hideAnyTooltip();
  updateAlertsOpen(+1);
  if (isOptionOn("sound")) {
    menuClick();
  }
  return new Promise((resolve) => {
    popupWrap.className = className;
    closeModaleButton.style.display = allowClose ? "" : "none";

    const popup = document.createElement("div");
    let closed = false;

    function closeWithResult(value: t | undefined) {
      if (closed) return;
      memorizeScrollPosition(id || title);
      closed = true;
      Array.prototype.forEach.call(
        popup.querySelectorAll("button:not([disabled])"),
        (b) => (b.disabled = true),
      );
      document.body.style.minHeight = document.body.scrollHeight + "px";
      setTimeout(() => (document.body.style.minHeight = ""), 0);
      popup.remove();
      resolve(value);
      menuClick();
    }

    if (allowClose) {
      closeModal = () => {
        closeWithResult(undefined);
      };
    } else {
      closeModal = null;
    }

    if (title) {
      const h1 = document.createElement("h1");
      h1.innerHTML = title;
      popup.appendChild(h1);
    }

    content
      ?.filter((i) => i)
      .forEach((entry, index) => {
        if (!entry) return;
        if (typeof entry == "string") {
          const p = document.createElement("div");
          p.innerHTML = entry;
          popup.appendChild(p);
          return;
        }

        let addto: HTMLElement;
        if (popup.lastChild?.nodeName == "SECTION") {
          addto = popup.lastChild as HTMLElement;
        } else {
          addto = document.createElement("section");
          addto.className = "actions";
          popup.appendChild(addto);
        }
        addButton(entry, index, addto, closeWithResult);
      });

    popup.addEventListener(
      "click",
      (e) => {
        const target = e.target as HTMLElement;
        if (target.getAttribute("data-resolve-to")) {
          closeWithResult(target.getAttribute("data-resolve-to") as t);
        }
      },
      true,
    );
    popupWrap.appendChild(popup);
    (
      popupWrap.querySelector(
        `section.actions > button.needs-focus`,
      ) as HTMLButtonElement
    )?.focus();
    lastClickedItemIndex = -1;

    revertScrollPosition(id || title);
  }).then(
    (v: unknown) => {
      updateAlertsOpen(-1);
      closeModal = null;
      return v as t | undefined;
    },
    () => {
      closeModal = null;
      updateAlertsOpen(-1);
    },
  );
}

function updateAlertsOpen(delta: number) {
  alertsOpen += delta;
  if (alertsOpen > 1) {
    alert("Two alerts where opened at once");
  }
  document.body.classList[alertsOpen ? "add" : "remove"]("has-alert-open");
}

function addButton<t>(
  entry: AsyncAlertAction<t>,
  index: number,
  addto: HTMLElement,
  closeWithResult: (r: t) => void,
) {
  const {
    text = "",
    link = "",
    value = null,
    help = "",
    disabled = false,
    className = "",
    icon = "",
    tooltip = "",
    actionLabel = "",
  } = entry;

  const buttonWrap = document.createElement("div");
  addto.appendChild(buttonWrap);

  if (actionLabel) {
    buttonWrap.className = className + " upgrade";

    buttonWrap.innerHTML = icon;

    const description = document.createElement("p");
    const name = link
      ? `<a href="${link}" target="_blank" rel="noopener noreferrer">${text}</a>`
      : text;
    description.innerHTML = `
              <strong>${name}</strong>
             ${help}
             `;
    description.setAttribute("data-tooltip", tooltip);
    description.setAttribute("data-help-content", tooltip);
    buttonWrap.appendChild(description);

    const button = document.createElement("button");
    button.textContent = actionLabel;
    button.disabled = disabled;
    if (!disabled)
      button.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();
        closeWithResult(value as t);
        // Focus "same" button if it's still there
        lastClickedItemIndex = index;
      });

    button.className = lastClickedItemIndex === index ? " needs-focus" : "";

    buttonWrap.appendChild(button);
    return;
  }

  const button = document.createElement("button");

  button.innerHTML = `
${icon}
<div>
                    <strong>${text}</strong>
                    <em>${help || ""}</em>
            </div>`;

  if (disabled) {
    button.setAttribute("disabled", "disabled");
  } else {
    button.addEventListener("click", (e) => {
      e.preventDefault();
      e.stopPropagation();
      closeWithResult(value as t);
      // Focus "same" button if it's still there
      lastClickedItemIndex = index;
    });
  }

  button.className =
    className +
    (lastClickedItemIndex === index ? " needs-focus" : "") +
    " choice-button";

  buttonWrap.appendChild(button);

  if (tooltip) {
    button.setAttribute("data-tooltip", tooltip);
  }
}

let memorizedScrollPosition: Record<string, number> = {};
function memorizeScrollPosition(title: string | undefined) {
  if (title && title?.length < 500)
    memorizedScrollPosition[title] = window.scrollY;
}
function revertScrollPosition(title: string | undefined) {
  if (title) window.scrollTo(0, memorizedScrollPosition[title] || 0);
}

window.backButtonCaptured = function () {
  if (closeModal) {
    closeModal();
    return true;
  } else {
    return false;
  }
};
