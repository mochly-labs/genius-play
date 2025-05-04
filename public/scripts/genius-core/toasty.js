// Toasty.js - A simple toast notification library
// Copyright (MIT, github.com/caffwydev & github.com/mochly-labs for Genius Play project)
// Depends on Font Awesome for icons

const Toasty = (() => {
  const defaults = {
    duration: 2000,
    position: "bottom-center",
    type: "info",
  };

  const icons = {
    success: "fas fa-check-circle",
    error: "fas fa-times-circle",
    warning: "fas fa-exclamation-triangle",
    info: "fas fa-info-circle",
  };

  const containerId = "__toasty_container__";
  function getContainer(position) {
    let container = document.getElementById(containerId);
    if (!container) {
      container = document.createElement("div");
      container.id = containerId;
      container.style.position = "fixed";
      container.style.zIndex = 9999;
      container.style.pointerEvents = "none";
      container.style.display = "flex";
      container.style.flexDirection = "column";
      container.style.gap = "10px";
      if (position === "bottom-center") {
        container.style.bottom = "20px";
        container.style.left = "50%";
        container.style.transform = "translateX(-50%)";
        container.style.alignItems = "center";
      }
      document.body.appendChild(container);
    }
    return container;
  }

  function createToast(message, opts = {}) {
    const { type, duration, position } = { ...defaults, ...opts };
    const iconClass = icons[type] || icons.info;

    const toast = document.createElement("div");
    toast.style.pointerEvents = "auto";
    toast.style.background = "rgba(0, 0, 0, 0.5)";
    toast.style.border = "1px solid #444";
    toast.style.color = "white";
    toast.style.padding = "10px 14px";
    toast.style.borderRadius = "6px";
    toast.style.fontFamily = "sans-serif";
    toast.style.display = "flex";
    toast.style.alignItems = "center";
    toast.style.boxShadow = "0 2px 8px rgba(0,0,0,0.3)";
    toast.style.gap = "10px";
    toast.style.transform = "translateY(100px)";
    toast.style.opacity = "0";
    toast.style.transition = "transform 0.4s ease, opacity 0.4s ease";

    const icon = document.createElement("i");
    icon.className = iconClass;
    icon.style.flexShrink = "0";
    toast.appendChild(icon);

    const text = document.createElement("span");
    text.textContent = message;
    toast.appendChild(text);

    const close = document.createElement("button");
    close.innerHTML = "&times;";
    close.style.background = "transparent";
    close.style.color = "white";
    close.style.border = "none";
    close.style.fontSize = "16px";
    close.style.marginLeft = "auto";
    close.style.cursor = "pointer";
    close.onclick = () => hideToast(toast);
    toast.appendChild(close);

    const container = getContainer(position);
    container.appendChild(toast);

    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        toast.style.transform = "translateY(0)";
        toast.style.opacity = "1";
      });
    });

    const timeout = setTimeout(() => hideToast(toast), duration);

    function hideToast(toastEl) {
      clearTimeout(timeout);
      toastEl.style.transform = "translateY(100px)";
      toastEl.style.opacity = "0";
      setTimeout(() => {
        toastEl.remove();
        if (container.children.length === 0) container.remove();
      }, 400);
    }
  }

  return {
    show: createToast,
  };
})();