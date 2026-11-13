import { isOptionOn } from "./options";

const tooltip = document.getElementById("tooltip") as HTMLDivElement;

export function setupTooltips() {
  if (isOptionOn("mobile-mode")) {
    setupMobileTooltips(tooltip);
  } else {
    setupDesktopTooltips(tooltip);
  }
}
export function hideAnyTooltip() {
  tooltip.style.display = "none";
}

function setupMobileTooltips(tooltip: HTMLDivElement) {
  tooltip.className = "mobile";

  function openTooltip(e: Event) {
    if (tooltip.style.display !== "none") {
      e.preventDefault();
      e.stopPropagation();
      hideAnyTooltip();
      return;
    }
    const hovering = e.target as HTMLElement;
    const tooltipContent =
      hovering?.getAttribute("data-help-content")?.trim() || "";
    if (!tooltipContent) {
      return;
    }
    e.stopPropagation();
    e.preventDefault();
    tooltip.innerHTML = tooltipContent;
    tooltip.style.display = "";
    const { top } = hovering.getBoundingClientRect();
    tooltip.style.transform = `translate(0,${top}px) translate(0,-100%)`;
  }

  document.body.addEventListener("click", openTooltip, true);
  document.addEventListener("scroll", hideAnyTooltip, true);
}

function setupDesktopTooltips(tooltip: HTMLDivElement) {
  tooltip.className = "desktop";
  function updateTooltipPosition(e: { clientX: number; clientY: number }) {
    tooltip.style.transform = `translate(${e.clientX}px,${e.clientY}px) translate(${e.clientX > window.innerWidth / 2 ? "-100%" : "0"},${e.clientY > (window.innerHeight * 2) / 3 ? "-100%" : "20px"})`;
  }

  function closeToolTip() {
    hideAnyTooltip();
    hovering = null;
  }

  let hovering: HTMLElement | null = null;

  document.body.addEventListener(
    "mouseenter",
    (e: MouseEvent) => {
      let parent: HTMLElement | null = e.target as HTMLElement;
      while (parent && !parent.hasAttribute("data-tooltip")) {
        parent = parent.parentElement;
      }
      if (parent?.getAttribute("data-tooltip")?.trim()) {
        hovering = parent as HTMLElement;
        tooltip.innerHTML = hovering.getAttribute("data-tooltip") || "";
        tooltip.style.display = "";
        updateTooltipPosition(e);
      } else {
        closeToolTip();
      }
    },
    true,
  );

  setInterval(() => {
    if (hovering) {
      if (!document.body.contains(hovering)) {
        closeToolTip();
      }
    }
  }, 200);
  document.body.addEventListener(
    "mousemove",
    (e) => {
      if (!tooltip.style.display) {
        updateTooltipPosition(e);
      }
    },
    true,
  );
  document.body.addEventListener(
    "mouseleave",
    (e) => {
      closeToolTip();
    },
    true,
  );
}
