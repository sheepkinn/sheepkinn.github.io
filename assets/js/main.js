(() => {
  "use strict";

  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");

  function setMeasuredHeight(element, variableName) {
    if (!element) return;

    const update = () => {
      document.documentElement.style.setProperty(
        variableName,
        `${Math.ceil(element.getBoundingClientRect().height)}px`,
      );
    };

    update();

    if ("ResizeObserver" in window) {
      const observer = new ResizeObserver(update);
      observer.observe(element);
    } else {
      window.addEventListener("resize", update, { passive: true });
    }
  }

  function initPageTransition() {
    const body = document.body;

    requestAnimationFrame(() => {
      requestAnimationFrame(() => body.classList.add("is-ready"));
    });

    window.addEventListener("pageshow", () => {
      body.classList.remove("is-leaving");
      body.classList.add("is-ready");
    });

    if (reducedMotion.matches) return;

    document.addEventListener("click", (event) => {
      if (
        event.defaultPrevented ||
        event.button !== 0 ||
        event.metaKey ||
        event.ctrlKey ||
        event.shiftKey ||
        event.altKey
      ) {
        return;
      }

      const link = event.target.closest("a[href]");
      if (!link || link.hasAttribute("download") || link.target === "_blank") return;

      const destination = new URL(link.href, window.location.href);
      const isSameDocument =
        destination.pathname === window.location.pathname &&
        destination.search === window.location.search;

      if (
        destination.origin !== window.location.origin ||
        destination.protocol === "mailto:" ||
        destination.protocol === "tel:" ||
        (isSameDocument && destination.hash)
      ) {
        return;
      }

      event.preventDefault();
      body.classList.remove("is-ready");
      body.classList.add("is-leaving");

      window.setTimeout(() => {
        window.location.assign(destination.href);
      }, 600);
    });
  }

  function initMenu() {
    const toggle = document.querySelector("[data-menu-toggle]");
    const navigation = document.querySelector("[data-menu]");
    if (!toggle || !navigation) return;

    const navLinks = Array.from(navigation.querySelectorAll("a[href]"));
    let lastFocused = null;

    const setOpen = (open) => {
      document.body.classList.toggle("menu-open", open);
      toggle.setAttribute("aria-expanded", String(open));
      toggle.setAttribute("aria-label", open ? "关闭导航" : "打开导航");
      navigation.setAttribute("aria-hidden", String(!open));

      if (open) {
        lastFocused = document.activeElement;
        window.setTimeout(() => navLinks[0]?.focus(), 30);
      } else if (lastFocused instanceof HTMLElement) {
        lastFocused.focus();
      }
    };

    toggle.addEventListener("click", () => {
      setOpen(!document.body.classList.contains("menu-open"));
    });

    navigation.addEventListener("click", (event) => {
      if (event.target.closest("a")) setOpen(false);
    });

    document.addEventListener("keydown", (event) => {
      if (!document.body.classList.contains("menu-open")) return;

      if (event.key === "Escape") {
        event.preventDefault();
        setOpen(false);
        return;
      }

      if (event.key !== "Tab") return;

      const focusable = [toggle, ...navLinks].filter(
        (element) => !element.hasAttribute("disabled"),
      );
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    });

    const mobileQuery = window.matchMedia("(max-width: 720px)");
    const handleViewportChange = (event) => {
      if (!event.matches && document.body.classList.contains("menu-open")) setOpen(false);
      navigation.setAttribute("aria-hidden", String(event.matches));
    };

    if (typeof mobileQuery.addEventListener === "function") {
      mobileQuery.addEventListener("change", handleViewportChange);
    } else {
      mobileQuery.addListener(handleViewportChange);
    }
    navigation.setAttribute("aria-hidden", String(mobileQuery.matches));
  }

  async function copyText(text) {
    if (navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(text);
      return;
    }

    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.setAttribute("readonly", "");
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    document.execCommand("copy");
    textarea.remove();
  }

  function initCodeBlocks() {
    document.querySelectorAll(".code-block").forEach((block) => {
      const code = block.querySelector("code");
      if (!code || block.querySelector(".copy-code")) return;

      const button = document.createElement("button");
      button.className = "copy-code";
      button.type = "button";
      button.textContent = "Copy";
      button.setAttribute("aria-label", "复制代码");

      button.addEventListener("click", async () => {
        try {
          await copyText(code.textContent);
          button.textContent = "Copied";
        } catch {
          button.textContent = "Failed";
        }

        window.setTimeout(() => {
          button.textContent = "Copy";
        }, 1600);
      });

      block.appendChild(button);
    });
  }

  function initCurrentYear() {
    document.querySelectorAll("[data-current-year]").forEach((element) => {
      element.textContent = String(new Date().getFullYear());
    });
  }

  document.addEventListener("DOMContentLoaded", () => {
    setMeasuredHeight(document.querySelector(".site-header"), "--header-height");
    setMeasuredHeight(document.querySelector(".site-footer"), "--footer-height");
    initMenu();
    initCodeBlocks();
    initCurrentYear();
    initPageTransition();
  });

  document.addEventListener("content:rendered", initCodeBlocks);
})();
