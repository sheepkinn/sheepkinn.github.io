(() => {
  "use strict";

  const POSTS = {
    "post-1": {
      title: "12 月 2 日小记",
      date: "2025-12-03",
      displayDate: "Dec 3, 2025",
      tags: ["Website", "Neovim", "tmux"],
      description:
        "首先，我想先记录一下先前的网站搭建的时间节点。因为我想规范一下 blog 列表，就把之前那几个看起来不像是博客的东西删掉了。",
    },
    "post-2": {
      title: "12 月 3 日小记",
      date: "2025-12-04",
      displayDate: "Dec 4, 2025",
      tags: ["Gemini CLI", "WSL", "npm"],
      description:
        "今天上午写了 12 月 2 日的小记，然后今天没有对网站相关的部分做出改动。今天下午主要尝试在 wsl 中下载和配置 gemini-cli。",
    },
    "post-3": {
      title: "12 月 4 日小记",
      date: "2025-12-05",
      displayDate: "Dec 5, 2025",
      tags: ["Website", "Ventoy", "Arch Linux"],
      description:
        "先总结一下网站更新。今天针对博客界面，增加了网页渲染出来的代码块和代码行的边框阴影和代码块内的斑马线。",
    },
    "post-4": {
      title: "12 月 10 日小记",
      date: "2025-12-10",
      displayDate: "Dec 10, 2025",
      tags: ["i3", "Linux", "日常"],
      description: "今日网站更新了个 icon，不会出现“反色的女孩”了。",
    },
  };

  function getPostName() {
    const fromPage = document.body.dataset.post;
    if (fromPage) return fromPage;
    return new URLSearchParams(window.location.search).get("post");
  }

  function updateMetadata(postName, metadata) {
    document.title = `${metadata.title} — Sheepkinn`;

    const title = document.querySelector("[data-article-title]");
    const date = document.querySelector("[data-article-date]");
    const tags = document.querySelector("[data-article-tags]");

    if (title) title.textContent = metadata.title;
    if (date) {
      date.dateTime = metadata.date;
      date.textContent = metadata.displayDate;
    }
    if (tags) {
      tags.replaceChildren(
        ...metadata.tags.map((tag) => {
          const item = document.createElement("li");
          item.textContent = tag;
          return item;
        }),
      );
    }

    const canonicalUrl = `https://sheepkinn.github.io/posts/${postName}.html`;
    const canonical = document.querySelector('link[rel="canonical"]');
    if (canonical) canonical.href = canonicalUrl;

    const values = {
      'meta[name="description"]': metadata.description,
      'meta[property="og:title"]': `${metadata.title} — Sheepkinn`,
      'meta[property="og:description"]': metadata.description,
      'meta[property="og:url"]': canonicalUrl,
    };

    Object.entries(values).forEach(([selector, value]) => {
      const element = document.querySelector(selector);
      if (element) element.setAttribute("content", value);
    });
  }

  function fixImages(container) {
    container.querySelectorAll("img").forEach((image) => {
      const normalizedSource = image.getAttribute("src")?.replaceAll("\\", "/");
      if (normalizedSource) image.setAttribute("src", normalizedSource);
      image.loading = "lazy";
      image.decoding = "async";
      if (!image.alt) image.alt = "文章配图";
    });
  }

  function enhanceAdmonitions(container) {
    container.querySelectorAll("blockquote").forEach((blockquote) => {
      const firstParagraph = blockquote.querySelector(":scope > p:first-child");
      if (!firstParagraph) return;

      const marker = firstParagraph.textContent.match(
        /^\[!([a-zA-Z0-9_-]+)(?:\|(#[0-9a-fA-F]{3,6}))?(?:\|(.+?))?\]\s*(.*)$/,
      );
      if (!marker) return;

      const [, type, customColor, customIcon, titleText] = marker;
      const admonition = document.createElement("aside");
      admonition.className = `admonition admonition-${type.toLowerCase()}`;

      if (customColor) {
        admonition.style.borderLeftColor = customColor;
      }

      const title = document.createElement("div");
      title.className = "admonition-title";
      if (customColor) title.style.color = customColor;
      title.textContent = `${customIcon ? `${customIcon} ` : ""}${titleText || type.toUpperCase()}`;

      const content = document.createElement("div");
      content.className = "admonition-content";
      firstParagraph.remove();
      while (blockquote.firstChild) content.appendChild(blockquote.firstChild);

      admonition.append(title, content);
      blockquote.replaceWith(admonition);
    });
  }

  function wrapCodeBlocks(container) {
    container.querySelectorAll("pre").forEach((pre) => {
      if (pre.parentElement?.classList.contains("code-block")) return;
      const code = pre.querySelector("code");
      if (!code) return;

      const languageClass = Array.from(code.classList).find((name) =>
        name.startsWith("language-"),
      );
      const language = languageClass?.replace("language-", "") || "text";
      const wrapper = document.createElement("div");
      wrapper.className = "code-block";
      wrapper.dataset.language = language;
      pre.replaceWith(wrapper);
      wrapper.appendChild(pre);
    });
  }

  function loadMermaid() {
    if (window.mermaid) return Promise.resolve(window.mermaid);

    return new Promise((resolve, reject) => {
      const script = document.createElement("script");
      script.src = "/assets/vendor/mermaid.min.js";
      script.onload = () => resolve(window.mermaid);
      script.onerror = () => reject(new Error("Mermaid failed to load"));
      document.head.appendChild(script);
    });
  }

  async function renderMermaid(container) {
    const diagrams = Array.from(container.querySelectorAll("pre code.language-mermaid"));
    if (!diagrams.length) return;

    const restorations = diagrams.map((code) => {
      const pre = code.parentElement;
      const diagram = document.createElement("div");
      diagram.className = "mermaid";
      diagram.textContent = code.textContent;
      pre.replaceWith(diagram);
      return { diagram, pre };
    });

    try {
      const mermaidApi = await loadMermaid();
      mermaidApi.initialize({
        startOnLoad: false,
        theme: "neutral",
        securityLevel: "strict",
        fontFamily: "Inter, sans-serif",
      });
      await mermaidApi.run({ nodes: restorations.map(({ diagram }) => diagram) });
    } catch {
      restorations.forEach(({ diagram, pre }) => {
        if (diagram.isConnected) diagram.replaceWith(pre);
      });
    }
  }

  function useSourceHeadingAsPageTitle(container, metadata) {
    const firstElement = container.firstElementChild;
    if (
      firstElement?.matches("h1, h2") &&
      firstElement.textContent.trim() === metadata.title
    ) {
      firstElement.remove();
    }
  }

  async function renderPost() {
    const container = document.querySelector("[data-markdown-content]");
    if (!container) return;

    const postName = getPostName();
    const metadata = POSTS[postName];

    if (!metadata) {
      container.innerHTML =
        "<h2>文章未找到</h2><p>这个链接没有对应到已发布的文章。</p>";
      return;
    }

    updateMetadata(postName, metadata);

    try {
      const response = await fetch(`/assets/posts/${postName}.md`, {
        headers: { Accept: "text/markdown, text/plain" },
      });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const markdownSource = await response.text();
      if (!window.marked?.parse) throw new Error("Markdown renderer unavailable");

      container.innerHTML = window.marked.parse(markdownSource, {
        gfm: true,
        breaks: false,
      });

      useSourceHeadingAsPageTitle(container, metadata);
      fixImages(container);
      enhanceAdmonitions(container);
      await renderMermaid(container);
      wrapCodeBlocks(container);

      if (window.Prism?.highlightAllUnder) {
        window.Prism.highlightAllUnder(container);
      }

      document.dispatchEvent(new CustomEvent("content:rendered"));
    } catch {
      container.innerHTML =
        "<h2>文章加载失败</h2><p>请稍后刷新页面，或从 GitHub 查看原始 Markdown 文件。</p>";
    }
  }

  document.addEventListener("DOMContentLoaded", renderPost);
})();
