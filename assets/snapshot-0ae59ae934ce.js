// Small browser-only interactions for the static copies of the original reader pages.
(() => {
  const root = document.querySelector('meta[name="gamehot-site-root"]')?.content;
  if (!root) return;
  const url = (part = "") => new URL(part, root).href;
  const read = (key, fallback) => { try { return JSON.parse(localStorage.getItem(key) || "null") ?? fallback; } catch { return fallback; } };
  const write = (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* Reading remains available without storage. */ } };
  const savedKey = "gamehot.saved.v1";
  const readKey = "gamehot.read.v1";
  const modes = { "深色": "dark", "跟随系统": "system", "浅色": "light" };
  let indexPromise;
  const index = () => indexPromise ??= fetch(url("search-index.json"), { credentials: "omit" }).then((r) => {
    if (!r.ok) throw new Error("搜索数据暂时不可用");
    return r.json();
  });
  const itemId = (element) => element.closest("[data-item-id]")?.dataset.itemId || document.body.dataset.snapshotItem || "";
  const saved = () => read(savedKey, {});
  const readItems = () => new Set(read(readKey, []));
  function theme(mode) {
    const dark = mode === "dark" || (mode === "system" && matchMedia("(prefers-color-scheme: dark)").matches);
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    try { localStorage.setItem("gamehot-theme", mode); } catch { /* System theme still works. */ }
    document.querySelectorAll('[role="radiogroup"][aria-label="外观"]').forEach((group) => {
      const buttons = [...group.querySelectorAll('[role="radio"]')];
      buttons.forEach((button) => button.setAttribute("aria-checked", String(modes[button.title] === mode)));
      const indicator = group.querySelector(':scope > [aria-hidden="true"]');
      if (indicator) indicator.style.transform = `translateX(${Math.max(0, buttons.findIndex((button) => modes[button.title] === mode)) * 100}%)`;
    });
  }
  let chosenTheme = "system";
  try { chosenTheme = localStorage.getItem("gamehot-theme") || "system"; } catch { /* Keep system setting. */ }
  theme(chosenTheme);
  matchMedia("(prefers-color-scheme: dark)").addEventListener?.("change", () => {
    try { if ((localStorage.getItem("gamehot-theme") || "system") === "system") theme("system"); } catch { theme("system"); }
  });
  function syncStars() {
    const current = saved();
    document.querySelectorAll('button[aria-label="收藏"], button[aria-label="取消收藏"]').forEach((button) => {
      const active = !!current[itemId(button)];
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active ? "取消收藏" : "收藏");
      button.title = active ? "取消收藏" : "收藏";
      button.style.color = active ? "var(--accent)" : "";
      const mark = button.querySelector("svg path");
      if (mark) mark.setAttribute("fill", active ? "currentColor" : "none");
    });
  }
  function node(tag, className, text) {
    const element = document.createElement(tag);
    if (className) element.className = className;
    if (text != null) element.textContent = text;
    return element;
  }
  function card(item, available) {
    const article = node("article", "snapshot-result-card");
    article.dataset.itemId = item.id;
    const header = node("div", "snapshot-result-meta");
    header.append(node("span", "", item.source || "游戏资讯"));
    if (item.selected) header.append(node("span", "snapshot-badge", "精选"));
    const star = node("button", "snapshot-star", "☆");
    star.type = "button"; star.setAttribute("aria-label", "收藏"); star.setAttribute("aria-pressed", "false");
    header.append(star);
    const title = node("h2", "snapshot-result-title");
    const link = node("a", "", item.title || "查看资讯");
    const local = available.has(item.id);
    link.href = local ? url(`items/${encodeURIComponent(item.id)}/`) : (item.original || url());
    if (!local && item.original) { link.target = "_blank"; link.rel = "noopener noreferrer"; }
    title.append(link); article.append(header, title);
    if (item.summary) article.append(node("p", "snapshot-result-summary", item.summary));
    if (item.reason) article.append(node("p", "snapshot-result-reason", `推荐理由：${item.reason}`));
    return article;
  }
  async function collection(view) {
    const main = document.querySelector("#main");
    if (!main) return;
    main.replaceChildren();
    const content = node("div", "snapshot-page");
    const heading = node("h1", "snapshot-title", view === "search" ? "搜索" : "收藏");
    const description = node("p", "snapshot-caption", view === "search" ? "搜索已收录的游戏资讯" : "收藏保存在当前浏览器中");
    content.append(heading, description);
    let input;
    if (view === "search") {
      const form = node("form", "snapshot-search-form");
      form.method = "get"; form.action = url("search/"); form.setAttribute("role", "search");
      input = node("input", "snapshot-search-input");
      input.type = "search"; input.name = "q"; input.placeholder = "搜索标题、摘要或来源"; input.setAttribute("aria-label", "搜索标题和摘要");
      input.value = new URL(location.href).searchParams.get("q") || "";
      form.append(input); content.append(form);
    }
    const status = node("p", "snapshot-caption snapshot-status", "正在加载…");
    const list = node("div", "snapshot-results");
    content.append(status, list); main.append(content);
    let entries = [];
    try { entries = await index(); } catch { status.textContent = "资讯暂时无法加载，请稍后刷新。"; return; }
    const available = new Set(entries.filter((entry) => entry.available).map((entry) => entry.id));
    const draw = () => {
      let displayed;
      if (view === "starred") displayed = Object.values(saved()).reverse();
      else {
        const words = input.value.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
        displayed = words.length ? entries.filter((entry) => {
          const text = [entry.title, entry.summary, entry.source, entry.reason].filter(Boolean).join(" ").toLocaleLowerCase();
          return words.every((word) => text.includes(word));
        }) : [];
      }
      list.replaceChildren(...displayed.map((item) => card(item, available)));
      status.textContent = view === "starred" ? (displayed.length ? `${displayed.length} 条收藏` : "还没有收藏，点击新闻旁边的书签即可保存。") :
        input.value.trim() ? (displayed.length ? `找到 ${displayed.length} 条相关资讯` : "没有找到相关资讯，试试其他关键词。") : "输入关键词开始搜索。";
      syncStars();
    };
    if (input) input.addEventListener("input", draw);
    draw();
  }
  function modal(kind) {
    document.querySelector(".snapshot-modal")?.remove();
    const overlay = node("div", "snapshot-modal");
    const panel = node("div", "snapshot-modal-panel");
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true");
    const title = node("h2", "snapshot-modal-title", kind === "search" ? "搜索资讯" : kind === "filter" ? "选择分类" : "热度怎么算");
    const close = node("button", "snapshot-modal-close", "关闭"); close.type = "button";
    const top = node("div", "snapshot-modal-top"); top.append(title, close); panel.append(top);
    if (kind === "search") {
      const form = node("form", "snapshot-search-form"); form.method = "get"; form.action = url("search/");
      const input = node("input", "snapshot-search-input"); input.type = "search"; input.name = "q"; input.placeholder = "搜索标题、摘要或来源"; input.setAttribute("aria-label", "搜索标题和摘要");
      const submit = node("button", "snapshot-submit", "搜索"); submit.type = "submit";
      form.append(input, submit); panel.append(form); setTimeout(() => input.focus(), 0);
    } else if (kind === "filter") {
      const group = node("div", "snapshot-filter-list");
      const allPage = location.pathname.includes("/all/") || location.pathname.includes("/filtered/all/");
      for (const [label, key] of [["全部", ""], ["一手", "first-party"], ["新作", "game-releases"], ["更新", "game-updates"], ["平台", "platform-offers"], ["行业", "industry"], ["攻略", "tip"], ["评测", "opinion"]]) {
        const link = node("a", "snapshot-filter-link", label);
        link.href = url(key ? `filtered/${allPage ? "all" : "selected"}/${key}/` : (allPage ? "all/" : ""));
        group.append(link);
      }
      panel.append(group);
    } else panel.append(node("p", "snapshot-caption", "热度按近期不同来源对同一事件的报道计算，较新的报道权重更高。"));
    close.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
    overlay.append(panel); document.body.append(overlay);
  }
  let unread = false;
  function syncUnread() {
    const seen = readItems();
    document.querySelectorAll("article[data-item-id]").forEach((article) => {
      const row = article.closest("li") || article;
      row.hidden = unread && seen.has(article.dataset.itemId);
    });
  }
  document.addEventListener("click", async (event) => {
    const link = event.target.closest("a[href]");
    if (link) {
      const article = link.closest("article[data-item-id]");
      if (article && link.href.includes("/items/")) {
        const seen = readItems(); seen.add(article.dataset.itemId); write(readKey, [...seen]);
      }
    }
    const button = event.target.closest("button");
    if (!button) return;
    if (button.getAttribute("role") === "radio" && modes[button.title]) { theme(modes[button.title]); return; }
    const label = button.getAttribute("aria-label") || button.title || button.textContent.trim();
    if (label === "收藏" || label === "取消收藏") {
      event.preventDefault(); event.stopPropagation();
      const id = itemId(button); if (!id) return;
      const current = saved();
      if (current[id]) delete current[id];
      else {
        let item = null;
        try { item = (await index()).find((entry) => entry.id === id); } catch { /* Fall back to the visible card. */ }
        const article = button.closest("article");
        item ||= { id, title: article?.querySelector("h2, h3")?.textContent?.trim() || document.querySelector("h1")?.textContent?.trim() || "游戏资讯", summary: article?.querySelector("p")?.textContent?.trim() || "", source: "游戏资讯" };
        current[id] = item;
      }
      write(savedKey, current); syncStars();
      if (document.body.dataset.snapshotView === "starred") collection("starred");
      return;
    }
    if (label === "搜索") { modal("search"); return; }
    if (label === "筛选") { modal("filter"); return; }
    if (label === "怎么算") { modal("heat"); return; }
    if (label === "回到顶部") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (label === "返回") { if (document.referrer.startsWith(location.origin)) history.back(); else location.href = root; return; }
    if (label === "我的") { location.href = url("more/"); return; }
    if (label === "分享") { if (navigator.share) navigator.share({ title: document.title, url: location.href }).catch(() => {}); else navigator.clipboard?.writeText(location.href); return; }
    if (button.textContent.includes("只看未读")) {
      unread = !unread; document.querySelectorAll("button").forEach((candidate) => {
        if (candidate.textContent.includes("只看未读")) candidate.setAttribute("aria-pressed", String(unread));
      }); syncUnread(); return;
    }
    const section = button.closest('section[aria-label]');
    if (section && button.hasAttribute("aria-expanded") && /^\d{4}-\d{2}-\d{2}$/.test(section.getAttribute("aria-label"))) {
      const open = button.getAttribute("aria-expanded") !== "true";
      section.querySelectorAll("button[aria-expanded]").forEach((b) => b.setAttribute("aria-expanded", String(open)));
      [...section.children].slice(1).forEach((child) => { child.hidden = !open; });
    }
  });
  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") document.querySelector(".snapshot-modal")?.remove();
    if (event.key === "/" && !/^(INPUT|TEXTAREA)$/.test(document.activeElement?.tagName || "")) {
      event.preventDefault(); const field = document.querySelector("#site-search"); if (field && field.offsetParent) field.focus(); else modal("search");
    }
  });
  syncStars();
  if (document.body.dataset.snapshotView) collection(document.body.dataset.snapshotView);
})();
