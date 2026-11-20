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
  function font(mode) {
    const value = mode === "browser" ? "browser" : "system";
    document.documentElement.dataset.font = value;
    try { localStorage.setItem("gamehot-font", value); } catch { /* Keep the choice for this page. */ }
    document.querySelectorAll('select[aria-label="字体"]').forEach((select) => { select.value = value; });
  }
  let chosenFont = "system";
  try { chosenFont = localStorage.getItem("gamehot-font") || "system"; } catch { /* Keep default. */ }
  font(chosenFont);
  document.querySelectorAll('select[aria-label="字体"]').forEach((select) => select.addEventListener("change", () => font(select.value)));
  function syncStars() {
    const current = saved();
    document.querySelectorAll('button[aria-label="收藏"], button[aria-label="取消收藏"], nav[aria-label="阅读工具"] button[aria-pressed]').forEach((button) => {
      const active = !!current[itemId(button)];
      button.setAttribute("aria-pressed", String(active));
      button.setAttribute("aria-label", active ? "取消收藏" : "收藏");
      button.title = active ? "取消收藏" : "收藏";
      button.style.color = active ? "var(--accent)" : "";
      const mark = button.querySelector("svg path");
      if (mark) mark.setAttribute("fill", active ? "currentColor" : "none");
      if (button.closest('nav[aria-label="阅读工具"]')) {
        const caption = [...button.childNodes].find((child) => child.nodeType === Node.TEXT_NODE && child.textContent.trim());
        if (caption) caption.textContent = active ? "已收藏" : "收藏";
      }
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
    // Saved records can outlive an export; only accept immutable assets from this snapshot.
    const image = item.image;
    if (image && typeof image.url === "string") {
      try {
        const asset = new URL(image.url);
        const base = new URL(root);
        if (asset.origin === base.origin && asset.pathname.startsWith(`${base.pathname}media/`) && !asset.search && !asset.hash) {
          const picture = node("img");
          picture.src = asset.href;
          picture.alt = typeof image.alt === "string" ? image.alt : "";
          picture.loading = "lazy"; picture.decoding = "async";
          picture.style.width = "100%"; picture.style.aspectRatio = "16 / 9"; picture.style.objectFit = "cover";
          article.append(picture);
        }
      } catch { /* Ignore malformed or obsolete saved images. */ }
    }
    return article;
  }
  async function searchCollection() {
    const page = document.querySelector("main > div > div.pb-6");
    const results = page?.querySelector("[data-search-results]");
    const status = page?.querySelector("[data-search-status]");
    const desktop = page?.querySelector("#site-search");
    if (!page || !results || !status || !desktop) return collection("search");

    const mobileForm = node("form", "snapshot-mobile-search");
    mobileForm.method = "get"; mobileForm.action = url("search/"); mobileForm.setAttribute("role", "search");
    const mobile = node("input", "snapshot-search-input");
    mobile.type = "search"; mobile.name = "q"; mobile.placeholder = "搜索标题、摘要或来源";
    mobile.setAttribute("aria-label", "搜索标题和摘要");
    mobileForm.append(mobile); page.querySelector("header[data-phone-bar]")?.after(mobileForm);

    let entries, feed;
    try {
      [entries, feed] = await Promise.all([
        index(),
        fetch(url("search-feed.json"), { credentials: "omit" }).then((r) => {
          if (!r.ok) throw new Error("Search rows unavailable");
          return r.json();
        }),
      ]);
    } catch { status.textContent = "资讯暂时无法加载，请稍后刷新。"; return; }

    const params = new URL(location.href).searchParams;
    let query = params.get("q") || "";
    const tag = params.get("tag") || "";
    const category = params.get("category") || "";
    const section = params.get("section") || "";
    const platform = params.get("platform") || "";
    const firstParty = params.get("channel") === "firstParty";
    const heading = page.querySelector("h1");
    let clearTag = null;
    if (tag) {
      const notice = node("p", "snapshot-search-status", `当前标签：#${tag} · `);
      clearTag = node("a", "", "取消标签");
      notice.append(clearTag); status.before(notice);
    }
    const nav = page.querySelector('nav[aria-label="筛选"]');
    const filterLinks = [...(nav?.querySelectorAll("a") || [])];
    const filterKind = (raw) => {
      if (!raw) return { kind: "", key: "" };
      if (raw === "first-party") return { kind: "channel", key: raw };
      if (raw.startsWith("s-")) return { kind: "section", key: raw.slice(2) };
      if (raw.startsWith("p-")) return { kind: "platform", key: raw.slice(2) };
      return { kind: "category", key: raw };
    };
    for (const link of filterLinks) {
      const match = new URL(link.href).pathname.match(/\/filtered\/(?:all|selected)\/([^/]+)\//);
      link.dataset.searchFilter = match?.[1] || "";
    }
    const browseTarget = () => {
      if (section) return `filtered/all/s-${encodeURIComponent(section)}/`;
      if (platform) return `filtered/all/p-${encodeURIComponent(platform)}/`;
      if (category) return `filtered/all/${encodeURIComponent(category)}/`;
      if (firstParty) return "filtered/all/first-party/";
      return "all/";
    };
    const updateLinks = () => {
      if (clearTag) {
        const target = query.trim() ? "search/" : browseTarget();
        const next = new URL(url(target));
        if (query.trim()) next.searchParams.set("q", query.trim());
        if (target === "search/") {
          if (section) next.searchParams.set("section", section);
          if (platform) next.searchParams.set("platform", platform);
          if (category) next.searchParams.set("category", category);
          if (firstParty) next.searchParams.set("channel", "firstParty");
        }
        clearTag.href = next.href;
      }
      for (const link of filterLinks) {
        const next = new URL(url("search/"));
        if (query.trim()) next.searchParams.set("q", query.trim());
        if (tag) next.searchParams.set("tag", tag);
        const { kind, key } = filterKind(link.dataset.searchFilter);
        if (kind === "channel") next.searchParams.set("channel", "firstParty");
        else if (kind === "section") { next.searchParams.set("section", key); if (platform) next.searchParams.set("platform", platform); }
        else if (kind === "platform") { next.searchParams.set("platform", key); if (section) next.searchParams.set("section", section); }
        else if (kind === "category") { next.searchParams.set("category", key); }
        link.href = next.href;
        const active = kind === "channel" ? firstParty
          : kind === "section" ? section === key
          : kind === "platform" ? platform === key
          : !section && !platform && !firstParty && category === key;
        if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
        link.classList.toggle("text-ink", active);
        link.classList.toggle("text-ink-3", !active);
        const indicator = link.querySelector(":scope > span.absolute");
        if (indicator && !active) indicator.remove();
        else if (!indicator && active) link.prepend(node("span", "absolute inset-0 rounded-full bg-surface shadow-[var(--shadow-thumb)] ring-1 ring-line dark:bg-raised"));
      }
    };
    const available = new Set(entries.filter((entry) => entry.available).map((entry) => entry.id));
    const draw = () => {
      desktop.value = mobile.value = query;
      // Set each tab's href and current state before reading the active one for the heading.
      updateLinks();
      page.querySelectorAll('nav[aria-label="按平台找全部动态"] a').forEach((link) => {
        const target = new URL(link.href);
        const linked = target.searchParams.get("platform") || decodeURIComponent(target.pathname.match(/\/filtered\/all\/p-([^/]+)\//)?.[1] || "");
        if (!linked) {
          link.removeAttribute("aria-current");
          return;
        }
        const active = !!platform && linked === platform;
        if (active) link.setAttribute("aria-current", "page"); else link.removeAttribute("aria-current");
        link.classList.toggle("bg-accent-soft", active);
        link.classList.toggle("text-accent", active);
        link.classList.toggle("bg-well", !active);
        link.classList.toggle("text-ink-2", !active);
      });
      page.querySelectorAll("[data-platform-children]").forEach((row) => {
        const groupKey = row.getAttribute("data-platform-children") || "";
        const open = !!platform && (groupKey === platform || !!row.querySelector('a[aria-current="page"]'));
        row.hidden = !open;
        row.className = open ? "mt-2 flex flex-wrap items-center gap-1.5 border-t border-line-soft pt-2" : "hidden";
      });
      const currentTab = filterLinks.find((link) => link.getAttribute("aria-current") === "page");
      const activePlatform = page.querySelector('nav[aria-label="按平台找全部动态"] a[aria-current="page"]')?.textContent?.trim();
      if (heading) heading.textContent = query.trim() ? `搜索“${query.trim()}”` : tag ? `#${tag}` : currentTab?.textContent?.trim() || (activePlatform ? `平台：${activePlatform}` : "搜索");
      const words = query.trim().toLocaleLowerCase().split(/\s+/).filter(Boolean);
      const matched = words.length || tag || category || firstParty || section || platform ? entries.filter((item) => {
        if (category && item.category !== category) return false;
        if (section && item.section !== section) return false;
        if (platform && !(item.platforms || []).includes(platform)) return false;
        if (firstParty && !item.firstParty) return false;
        if (tag && !(item.tags || []).includes(tag)) return false;
        const text = [item.title, item.summary, item.source, item.reason, ...(item.tags || [])].filter(Boolean).join(" ").toLocaleLowerCase();
        return words.every((word) => text.includes(word));
      }) : [];
      const days = new Map();
      for (const item of matched) {
        const day = item.day || "";
        if (!days.has(day)) days.set(day, []);
        days.get(day).push(item);
      }
      results.replaceChildren();
      for (const [day, items] of days) {
        const section = node("section");
        section.setAttribute("aria-label", day);
        if (feed.days[day]) {
          // Fragments come from the site's own escaped, sanitized static reader pages.
          const template = document.createElement("template"); template.innerHTML = feed.days[day];
          section.append(template.content.cloneNode(true));
          section.querySelectorAll(".num").forEach((count) => { count.textContent = String(items.length); });
        }
        const list = node("ol", "lg:pt-1");
        for (const item of items) {
          if (feed.cards[item.id]?.html) {
            const template = document.createElement("template"); template.innerHTML = feed.cards[item.id].html;
            list.append(template.content.cloneNode(true));
          } else {
            const row = node("li"); row.append(card(item, available)); list.append(row);
          }
        }
        section.append(list); results.append(section);
      }
      status.textContent = query.trim() || tag || category || firstParty || section || platform ? (matched.length ? `找到 ${matched.length} 条 · 已收录资讯` : "没有找到相关资讯，试试其他筛选或关键词。") : "输入关键词开始搜索。";
      syncStars();
    };
    for (const input of [desktop, mobile]) input.addEventListener("input", () => {
      query = input.value;
      const next = new URL(location.href);
      if (query.trim()) next.searchParams.set("q", query.trim()); else next.searchParams.delete("q");
      history.replaceState(null, "", next);
      draw();
    });
    for (const form of [desktop.form, mobileForm]) form?.addEventListener("submit", (event) => event.preventDefault());
    draw();
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
      if (view === "starred") {
        const current = new Map(entries.map((entry) => [entry.id, entry]));
        displayed = Object.values(saved()).reverse().map((item) => ({ ...item, image: current.get(item.id)?.image ?? null }));
      }
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
  function modal(kind, detail = "") {
    document.querySelector(".snapshot-modal")?.remove();
    const overlay = node("div", "snapshot-modal");
    const panel = node("div", "snapshot-modal-panel");
    panel.setAttribute("role", "dialog"); panel.setAttribute("aria-modal", "true");
    const title = node("h2", "snapshot-modal-title", kind === "search" ? "搜索资讯" : kind === "filter" ? "选择分类" : kind === "participants" ? "参与报道的来源" : kind === "outline" ? detail : kind === "share" ? "分享链接" : "热度怎么算");
    const close = node("button", "snapshot-modal-close", "关闭"); close.type = "button";
    const top = node("div", "snapshot-modal-top"); top.append(title, close); panel.append(top);
    if (kind === "search") {
      const form = node("form", "snapshot-search-form"); form.method = "get"; form.action = url("search/");
      const current = new URL(location.href);
      const filtered = current.pathname.match(/\/filtered\/(?:selected|all)\/([^/]+)\//)?.[1];
      const category = current.searchParams.get("category") || (filtered && !["first-party"].includes(filtered) && !filtered.startsWith("s-") && !filtered.startsWith("p-") ? filtered : "");
      const channel = current.searchParams.get("channel") || (filtered === "first-party" ? "firstParty" : "");
      const section = current.searchParams.get("section") || (filtered?.startsWith("s-") ? filtered.slice(2) : "");
      const platform = current.searchParams.get("platform") || (filtered?.startsWith("p-") ? filtered.slice(2) : "");
      const tag = current.searchParams.get("tag") || "";
      for (const [name, value] of Object.entries({ category, channel, section, platform, tag })) {
        if (!value) continue;
        const hidden = node("input"); hidden.type = "hidden"; hidden.name = name; hidden.value = value; form.append(hidden);
      }
      const input = node("input", "snapshot-search-input"); input.type = "search"; input.name = "q"; input.placeholder = "搜索标题、摘要或来源"; input.setAttribute("aria-label", "搜索标题和摘要");
      const submit = node("button", "snapshot-submit", "搜索"); submit.type = "submit";
      form.append(input, submit); panel.append(form); setTimeout(() => input.focus(), 0);
    } else if (kind === "share") {
      panel.append(node("p", "snapshot-caption", "复制下面的链接即可分享："));
      const input = node("input", "snapshot-search-input");
      input.type = "text"; input.readOnly = true; input.value = location.href; input.setAttribute("aria-label", "页面链接");
      input.addEventListener("focus", () => input.select());
      panel.append(input); setTimeout(() => { input.focus(); input.select(); }, 0);
    } else if (kind === "outline") {
      overlay.classList.add("snapshot-outline-sheet");
      const list = node("ol", "snapshot-outline-list");
      const reportStart = document.querySelector("main #report-start");
      const headings = reportStart ? [reportStart, ...document.querySelectorAll('main section[id^="s-"]')] : [...document.querySelectorAll("main h2[id], main h3[id]")];
      for (const element of headings) {
        const id = element.id;
        const text = element === reportStart ? "头版" : (element.matches("section") ? element.querySelector("h2, h3")?.textContent : element.textContent)?.trim();
        if (!id || !text) continue;
        const row = node("li");
        const link = node("a", "snapshot-outline-link", text);
        link.href = `#${encodeURIComponent(id)}`;
        link.addEventListener("click", () => overlay.remove());
        row.append(link); list.append(row);
      }
      if (list.children.length) panel.append(list); else panel.append(node("p", "snapshot-caption", "暂无目录。"));
    } else if (kind === "filter") {
      const group = node("div", "snapshot-filter-list");
      const isSearch = document.body.dataset.snapshotView === "search";
      const allPage = isSearch || location.pathname.includes("/all/") || location.pathname.includes("/filtered/all/");
      for (const [label, kind, key] of [
        ["全部", "", ""],
        ["新作发售", "section", "releases"], ["版本更新", "section", "updates"], ["平台与硬件", "section", "platform"],
        ["行业与赛事", "section", "industry"], ["评测与深度", "section", "reviews"],
        ["官方公告", "channel", "first-party"],
      ]) {
        const link = node("a", "snapshot-filter-link", label);
        if (isSearch) {
          const next = new URL(url("search/"));
          const query = new URL(location.href).searchParams.get("q");
          const tag = new URL(location.href).searchParams.get("tag");
          const platform = new URL(location.href).searchParams.get("platform");
          if (query) next.searchParams.set("q", query);
          if (tag) next.searchParams.set("tag", tag);
          if (kind === "channel") next.searchParams.set("channel", "firstParty");
          else if (kind === "section") { next.searchParams.set("section", key); if (platform) next.searchParams.set("platform", platform); }
          link.href = next.href;
        } else link.href = url(kind === "channel" ? `filtered/${allPage ? "all" : "selected"}/first-party/` : kind === "section" ? `filtered/${allPage ? "all" : "selected"}/s-${key}/` : (allPage ? "all/" : ""));
        group.append(link);
      }
      panel.append(group);
    } else panel.append(node("p", "snapshot-caption", kind === "participants" ? (detail || "暂无来源名单") : "热度按近期不同来源对同一事件的报道计算，较新的报道权重更高。"));
    close.addEventListener("click", () => overlay.remove());
    overlay.addEventListener("click", (event) => { if (event.target === overlay) overlay.remove(); });
    overlay.append(panel); document.body.append(overlay);
  }
  const groupCache = new Map();
  async function toggleGroup(button) {
    const groupId = button.dataset.snapshotGroup;
    const parent = button.parentElement;
    const article = button.closest("article[data-item-id]");
    if (!groupId || !parent || !article) return;
    let panel = parent.querySelector(":scope > [data-snapshot-group-panel]");
    if (panel) {
      panel.hidden = !panel.hidden;
      button.setAttribute("aria-expanded", String(!panel.hidden));
      return;
    }
    panel = node("div", "snapshot-group-panel anim-collapse-in");
    panel.dataset.snapshotGroupPanel = "";
    panel.append(node("p", "snapshot-caption", "正在加载…"));
    parent.append(panel); button.setAttribute("aria-expanded", "true");
    try {
      let request = groupCache.get(groupId);
      if (!request) {
        request = fetch(url(`groups/${encodeURIComponent(groupId)}.json`), { credentials: "omit" }).then((r) => {
          if (!r.ok) throw new Error("Group unavailable");
          return r.json();
        });
        groupCache.set(groupId, request);
      }
      const data = await request;
      const others = data.reports.filter((report) => report.id !== article.dataset.itemId);
      panel.replaceChildren();
      if (!others.length) panel.append(node("p", "snapshot-caption", "暂无其他报道。"));
      for (const report of others) {
        const row = node("div", "snapshot-group-row"); row.dataset.itemId = report.id;
        const source = node("span", "snapshot-group-source", report.source);
        const title = node("a", "snapshot-group-title", report.title);
        title.href = report.available ? url(`items/${encodeURIComponent(report.id)}/`) : report.original;
        if (!report.available) { title.target = "_blank"; title.rel = "noopener noreferrer"; }
        row.append(source, title); panel.append(row);
      }
    } catch {
      groupCache.delete(groupId);
      panel.remove(); button.setAttribute("aria-expanded", "false");
    }
  }
  let unread = false;
  function syncUnread() {
    const seen = readItems();
    document.querySelectorAll("article[data-item-id]").forEach((article) => {
      const row = article.closest("li") || article;
      let members = [];
      try { members = JSON.parse(row.dataset.snapshotMemberIds || "[]"); } catch { /* A plain report has no group. */ }
      row.hidden = unread && seen.has(article.dataset.itemId) && !members.some((id) => !seen.has(id));
    });
  }
  function setupTimeline() {
    const loader = document.querySelector("[data-snapshot-feed]");
    if (!loader) return;
    const button = loader.querySelector("[data-snapshot-more]");
    const status = loader.querySelector('[role="status"]');
    let chunks;
    try { chunks = JSON.parse(loader.dataset.snapshotChunks); } catch { return; }
    if (!button || !status || !Array.isArray(chunks)) return;
    let next = 0, loading = false, observer;
    async function more() {
      if (loading || next >= chunks.length) return;
      loading = true; button.disabled = true; status.textContent = "正在加载…";
      try {
        const response = await fetch(url(chunks[next]), { credentials: "omit" });
        if (!response.ok) throw new Error("Feed chunk unavailable");
        const fragments = await response.json();
        if (!Array.isArray(fragments)) throw new Error("Invalid feed chunk");
        for (const html of fragments) {
          const template = document.createElement("template"); template.innerHTML = html;
          const section = template.content.querySelector("section[aria-label]");
          const day = section?.getAttribute("aria-label");
          if (!day || !/^\d{4}-\d{2}-\d{2}$/.test(day)) continue;
          const existing = [...loader.parentElement.querySelectorAll("section[aria-label]")].find((el) => el.getAttribute("aria-label") === day);
          if (existing) {
            const list = existing.querySelector("ol"), added = section.querySelector("ol");
            if (list && added) list.append(...added.children);
          } else loader.before(section);
        }
        next++; status.textContent = "";
        syncStars(); syncUnread();
        if (next >= chunks.length) { observer?.disconnect(); loader.remove(); }
      } catch {
        observer?.disconnect(); status.textContent = "加载失败，请重试。";
      } finally { loading = false; button.disabled = false; }
    }
    button.addEventListener("click", more);
    if ("IntersectionObserver" in window) {
      observer = new IntersectionObserver((entries) => { if (entries.some((entry) => entry.isIntersecting)) more(); }, { rootMargin: "600px 0px" });
      observer.observe(loader);
    }
  }
  function setupChangelog() {
    if (!document.body.hasAttribute("data-snapshot-changelog")) return;
    const buttons = [...document.querySelectorAll("[data-changelog-filter]")];
    const rows = [...document.querySelectorAll("[data-changelog-kind]")];
    if (!buttons.length || !rows.length) return;
    const sections = [...new Set(rows.map((row) => row.closest("section[id^='d-']")).filter(Boolean))];
    const notice = node("p", "snapshot-caption snapshot-changelog-empty", "这个类型暂时没有更新。");
    notice.hidden = true; sections.at(-1)?.after(notice);
    for (const button of buttons) button.addEventListener("click", () => {
      const kind = button.dataset.changelogFilter;
      buttons.forEach((other) => {
        const active = other === button;
        other.setAttribute("aria-pressed", String(active));
        other.classList.toggle("bg-well", active); other.classList.toggle("font-medium", active);
        other.classList.toggle("text-ink", active); other.classList.toggle("text-ink-2", !active);
      });
      rows.forEach((row) => { row.hidden = kind !== "全部" && row.dataset.changelogKind !== kind; });
      sections.forEach((section) => { section.hidden = ![...section.querySelectorAll("[data-changelog-kind]")].some((row) => !row.hidden); });
      notice.hidden = sections.some((section) => !section.hidden);
      document.querySelectorAll('nav[aria-label="按月份"] a').forEach((link) => {
        const month = link.hash.slice(3, 10);
        const matches = rows.filter((row) => !row.hidden && row.closest("section")?.id.slice(2, 9) === month);
        link.hidden = !matches.length;
        const count = link.querySelector(".num"); if (count) count.textContent = `${matches.length} 条`;
        const first = matches[0]?.closest("section"); if (first) link.hash = first.id;
      });
    });
  }
  function chooseTab(button) {
    const group = button.closest('[role="tablist"]');
    if (!group) return;
    const tabs = [...group.querySelectorAll('[role="tab"]')];
    const thumb = tabs.map((tab) => tab.querySelector(":scope > span.absolute")).find(Boolean);
    for (const tab of tabs) {
      const active = tab === button;
      tab.setAttribute("aria-selected", String(active));
      tab.classList.toggle("text-ink", active); tab.classList.toggle("text-ink-3", !active);
    }
    if (thumb) button.prepend(thumb);
  }
  function setupStory() {
    const root = document.querySelector("#event-reports");
    const tabs = [...document.querySelectorAll("[data-story-filter]")];
    if (!root || !tabs.length) return;
    const rows = [...root.querySelectorAll("[data-story-report]")];
    const days = [...root.querySelectorAll("[data-story-day]")];
    const afterDays = days.at(-1)?.nextSibling || null;
    const dayParent = days[0]?.parentElement;
    const notice = node("p", "py-10 text-center text-[13px] text-ink-4", "这个筛选下没有报道。");
    notice.hidden = true;
    if (dayParent) dayParent.insertBefore(notice, afterDays);
    else root.lastElementChild?.append(notice);
    let filter = "all", order = "desc";
    const selects = [...document.querySelectorAll('select[aria-label="报道时间线排序"], select[aria-label="事件进展排序"]')];
    function draw() {
      rows.forEach((row) => { row.hidden = filter === "official" ? row.dataset.storyOfficial !== "true" : filter === "selected" ? row.dataset.storySelected !== "true" : false; });
      for (const day of days) {
        const list = day.querySelector("ol");
        if (list) [...list.querySelectorAll(":scope > [data-story-report]")].sort((a, b) => (order === "desc" ? -1 : 1) * (Date.parse(a.dataset.storyAt) - Date.parse(b.dataset.storyAt))).forEach((row) => list.append(row));
        day.hidden = ![...day.querySelectorAll("[data-story-report]")].some((row) => !row.hidden);
      }
      if (dayParent) [...days].sort((a, b) => (order === "desc" ? -1 : 1) * a.dataset.storyDay.localeCompare(b.dataset.storyDay)).forEach((day) => dayParent.insertBefore(day, notice));
      notice.hidden = rows.some((row) => !row.hidden);
      const developments = [...document.querySelectorAll("[data-story-development-at]")];
      if (developments.length) developments.sort((a, b) => (order === "desc" ? -1 : 1) * (Date.parse(a.dataset.storyDevelopmentAt) - Date.parse(b.dataset.storyDevelopmentAt))).forEach((row) => row.parentElement.append(row));
      selects.forEach((select) => { select.value = order; });
    }
    for (const button of tabs) button.addEventListener("click", () => { filter = button.dataset.storyFilter; chooseTab(button); draw(); });
    for (const select of selects) select.addEventListener("change", () => { order = select.value === "asc" ? "asc" : "desc"; draw(); });
    document.querySelector("[data-story-show-official]")?.addEventListener("click", () => {
      tabs.find((button) => button.dataset.storyFilter === "official")?.click();
      root.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  }
  function toast(message) {
    document.querySelector(".snapshot-toast")?.remove();
    const status = node("div", "snapshot-toast", message);
    status.setAttribute("role", "status"); document.body.append(status);
    setTimeout(() => status.remove(), 2500);
  }
  async function share() {
    if (navigator.share) {
      try { await navigator.share({ title: document.title, url: location.href }); return; }
      catch (error) { if (error?.name === "AbortError") return; }
    }
    try {
      if (!navigator.clipboard) throw new Error("Clipboard unavailable");
      await navigator.clipboard.writeText(location.href); toast("链接已复制");
    } catch { modal("share"); }
  }
  document.addEventListener("click", async (event) => {
    const link = event.target.closest("a[href]");
    if (link) {
      const article = link.closest("[data-item-id]");
      if (article && link.href.includes("/items/")) {
        const seen = readItems(); seen.add(article.dataset.itemId); write(readKey, [...seen]);
      }
    }
    const button = event.target.closest("button");
    if (!button) return;
    if (button.dataset.snapshotGroup) { event.preventDefault(); event.stopPropagation(); await toggleGroup(button); return; }
    if (button.hasAttribute("data-snapshot-back")) {
      const previous = document.referrer ? new URL(document.referrer) : null;
      const siteRoot = new URL(root);
      if (previous && previous.origin === siteRoot.origin && previous.pathname.startsWith(siteRoot.pathname)) history.back();
      else location.href = url(button.dataset.snapshotBack);
      return;
    }
    if (button.dataset.storyNav) {
      const target = document.getElementById(button.dataset.storyNav);
      if (target) { chooseTab(button); target.scrollIntoView({ behavior: "smooth", block: "start" }); }
      return;
    }
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
    if (label === "搜索" && button.type !== "submit") { modal("search"); return; }
    if (label === "本期目录" || label === "目录") { modal("outline", label); return; }
    if (label === "筛选" || label === "筛选（已选）") { modal("filter"); return; }
    if (label === "怎么算") { modal("heat"); return; }
    if (/位参与者，查看名单/.test(label)) { event.preventDefault(); event.stopPropagation(); modal("participants", button.title); return; }
    if (label === "回到顶部") { window.scrollTo({ top: 0, behavior: "smooth" }); return; }
    if (label === "返回") { if (document.referrer.startsWith(location.origin)) history.back(); else location.href = root; return; }
    if (label === "我的") { location.href = url("more/"); return; }
    if (label === "分享") { await share(); return; }
    if (button.textContent.includes("只看未读")) {
      unread = !unread; document.querySelectorAll("button").forEach((candidate) => {
        if (!candidate.textContent.includes("只看未读")) return;
        candidate.setAttribute("aria-pressed", String(unread));
        for (const name of ["border-accent/35", "bg-accent-soft", "text-accent"]) candidate.classList.toggle(name, unread);
        for (const name of ["border-line-strong", "bg-surface", "text-ink-2", "hover:border-ink-4", "hover:text-ink"]) candidate.classList.toggle(name, !unread);
        const mark = candidate.querySelector(':scope > span[aria-hidden="true"]');
        if (mark) {
          for (const name of ["border-accent", "bg-accent", "text-accent-contrast"]) mark.classList.toggle(name, unread);
          mark.classList.toggle("border-line-strong", !unread);
          mark.textContent = unread ? "✓" : ""; mark.style.fontSize = "11px"; mark.style.fontWeight = "700";
        }
      }); syncUnread(); return;
    }
    const section = button.closest('section[aria-label]');
    if (section && section.firstElementChild?.contains(button) && button.hasAttribute("aria-expanded") && /^\d{4}-\d{2}-\d{2}$/.test(section.getAttribute("aria-label"))) {
      const open = button.getAttribute("aria-expanded") !== "true";
      section.firstElementChild.querySelectorAll("button[aria-expanded]").forEach((b) => b.setAttribute("aria-expanded", String(open)));
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
  setupTimeline();
  setupChangelog();
  setupStory();
  if (document.body.dataset.snapshotView === "search") searchCollection();
  else if (document.body.dataset.snapshotView) collection(document.body.dataset.snapshotView);
  if ("serviceWorker" in navigator) {
    window.addEventListener("load", () => {
      const scope = new URL(root).pathname;
      navigator.serviceWorker.register(url("sw.js"), { scope }).catch(() => {});
    }, { once: true });
  }
})();
