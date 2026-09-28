(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EIPublishedReader = api;
  if (root && root.document) root.document.addEventListener("DOMContentLoaded", () => api.boot(root));
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SECTIONS = Object.freeze({
    latest: { label: "最新", kind: "all" },
    articles: { label: "文章资讯", kind: "article" },
    papers: { label: "论文研究", kind: "paper" },
    policies: { label: "地方政策", kind: "policy" },
    wechat: { label: "关注公众号", kind: "wechat" },
    standards: { label: "标准跟踪", kind: "standard" },
    daily: { label: "日报", period: "daily" },
    weekly: { label: "周报", period: "weekly" },
    monthly: { label: "月报", period: "monthly" },
    discover: { label: "更多动态", kind: "discover" },
  });
  const KINDS = new Set(["article", "paper", "policy", "standard"]);
  const CHANNELS = new Set(["website", "wechat", "x"]);
  const STAGES = new Set(["proposal", "drafting", "consultation", "review", "published", "effective", "withdrawn"]);
  const STAGE_LABELS = Object.freeze({ proposal: "提案", drafting: "起草中", consultation: "征求意见", review: "审查中", published: "已发布", effective: "已实施", withdrawn: "已废止" });
  const FILTERS = Object.freeze({ policies: ["region"], wechat: ["source"], standards: ["organization", "stage"] });

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function safeSourceUrl(value) {
    if (typeof value !== "string") return null;
    try {
      const input = value.trim();
      const authority = input.match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]*)/);
      if (authority && authority[1].includes("@")) return null;
      const url = new URL(input);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
      return url.href;
    } catch (_) { return null; }
  }

  function plainText(value) { return typeof value === "string" ? value : ""; }
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
  }
  function projectCatalog(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const catalog = {
      kind: KINDS.has(value.kind) ? value.kind : "",
      source_name: plainText(value.source_name),
      source_channel: CHANNELS.has(value.source_channel) ? value.source_channel : "",
    };
    if (catalog.kind === "policy" && typeof value.region === "string") catalog.region = value.region;
    if (catalog.kind === "paper" && value.paper && typeof value.paper === "object" && !Array.isArray(value.paper)) {
      catalog.paper = { url: safeSourceUrl(value.paper.url) };
    }
    if (catalog.kind === "standard" && value.standard && typeof value.standard === "object" && !Array.isArray(value.standard)) {
      catalog.standard = {
        identifier: plainText(value.standard.identifier),
        organization: plainText(value.standard.organization),
        stage: STAGES.has(value.standard.stage) ? value.standard.stage : "",
        as_of: validDate(value.standard.as_of),
      };
    }
    return catalog;
  }
  function projectArticle(item, schemaVersion) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const article = {
      id: plainText(item.id), title: plainText(item.title), intro: plainText(item.intro),
      body: plainText(item.body), published_at: plainText(item.published_at),
      source: { id: plainText(item.source && item.source.id), url: safeSourceUrl(item.source && item.source.url) },
      catalog: schemaVersion === 3 ? projectCatalog(item.catalog) : null,
    };
    return article;
  }
  function projectBriefing(item) {
    if (!item || typeof item !== "object" || !["daily", "weekly", "monthly"].includes(item.period)) return null;
    return {
      id: plainText(item.id), period: item.period, start_date: plainText(item.start_date),
      end_date: plainText(item.end_date), title: plainText(item.title), summary: plainText(item.summary),
      sections: Array.isArray(item.sections) ? item.sections.map((section) => ({
        heading: plainText(section && section.heading), body: plainText(section && section.body),
        article_ids: Array.isArray(section && section.article_ids) ? section.article_ids.filter((id) => typeof id === "string") : [],
      })) : [],
    };
  }
  function normalizeSnapshot(data) {
    if (!data || typeof data !== "object" || ![1, 2, 3].includes(data.schema_version)) throw new Error("snapshot");
    const articles = (Array.isArray(data.articles) ? data.articles : []).map((item) => projectArticle(item, data.schema_version)).filter((item) => item && item.id);
    const briefings = data.schema_version === 1 ? [] : (Array.isArray(data.briefings) ? data.briefings : []).map(projectBriefing).filter((item) => item && item.id);
    return { schema_version: data.schema_version, articles, briefings };
  }

  function validTimestamp(value, now = Date.now()) {
    if (typeof value !== "string") return "";
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/);
    if (!match) return "";
    const [, year, month, day, hour, minute, second, offsetHour = "0", offsetMinute = "0"] = match;
    const calendar = new Date(0);
    calendar.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
    if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() !== Number(month) - 1 ||
        calendar.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 ||
        Number(second) > 59 || Number(offsetHour) > 23 || Number(offsetMinute) > 59) return "";
    const time = Date.parse(value);
    if (!Number.isFinite(time) || time > now) return "";
    return new Date(time).toISOString();
  }
  function normalizeNews(data, now = Date.now()) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return { updated_at: null, items: [] };
    const updatedAt = data.updated_at === null ? null : validTimestamp(data.updated_at, now) || null;
    const items = (Array.isArray(data.items) ? data.items : []).map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const publishedAt = validTimestamp(item.published_at, now);
      const placement = item.placement;
      const sourceUrl = safeSourceUrl(item.source && item.source.url);
      const catalog = item.catalog;
      if (!publishedAt || !["main", "secondary"].includes(placement) || !sourceUrl ||
          !item.source || typeof item.source !== "object" || typeof item.source.id !== "string" ||
          !catalog || !["article", "paper"].includes(catalog.kind) || catalog.source_channel !== "website" ||
          item.format !== "source_excerpt" || typeof item.id !== "string" || !item.id.startsWith("news-") ||
          typeof item.title !== "string" || !item.title.trim() || typeof item.intro !== "string" || !item.intro.trim() ||
          !item.source.id.trim()) return null;
      return {
        id: item.id, title: item.title, intro: item.intro, body: "", published_at: publishedAt,
        source: { id: plainText(item.source.id), url: sourceUrl },
        catalog: { kind: catalog.kind, source_name: plainText(catalog.source_name), source_channel: "website",
          ...(catalog.kind === "paper" && catalog.paper && safeSourceUrl(catalog.paper.url) ? { paper: { url: safeSourceUrl(catalog.paper.url) } } : {}) },
        placement, format: "source_excerpt",
      };
    }).filter(Boolean);
    return { updated_at: updatedAt, items };
  }

  function dateKey(value) {
    if (!value) return "";
    const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "";
  }
  function periodForSection(section) { return SECTIONS[section] ? SECTIONS[section].period : null; }
  function articleKind(article) { return article.catalog ? article.catalog.kind : "article"; }
  function isBriefing(item) { return Boolean(item && Array.isArray(item.sections) && item.period); }
  function entryDate(item) { return isBriefing(item) ? item.end_date : dateKey(item.published_at); }
  function sortEntries(entries) {
    return entries.slice().sort((a, b) => (Date.parse(b.published_at || `${entryDate(b)}T00:00:00Z`) || 0) - (Date.parse(a.published_at || `${entryDate(a)}T00:00:00Z`) || 0) || a.id.localeCompare(b.id));
  }
  function mergedNews(snapshot, placement = "main") {
    const editedSources = new Set(snapshot.articles.map((item) => `${item.source.id}\n${safeSourceUrl(item.source.url) || ""}`));
    return (snapshot.news ? snapshot.news.items : []).filter((item) => item.placement === placement &&
      !editedSources.has(`${item.source.id}\n${safeSourceUrl(item.source.url) || ""}`));
  }
  function collection(snapshot, section) {
    if (!SECTIONS[section]) return [];
    if (periodForSection(section)) return sortEntries(snapshot.briefings.filter((item) => item.period === periodForSection(section)));
    if (section === "discover") return sortEntries(mergedNews(snapshot, "secondary"));
    if (section === "latest") return sortEntries([...snapshot.articles, ...mergedNews(snapshot)]);
    if (section === "wechat") return sortEntries(snapshot.articles.filter((item) => item.catalog && item.catalog.source_channel === "wechat"));
    return sortEntries([...snapshot.articles.filter((item) => articleKind(item) === SECTIONS[section].kind),
      ...mergedNews(snapshot).filter((item) => item.catalog.kind === SECTIONS[section].kind)]);
  }
  function optionsFor(snapshot, section) {
    const entries = collection(snapshot, section);
    if (section === "policies") return { region: uniqueOptions(entries.map((item) => [item.catalog && item.catalog.region, item.catalog && item.catalog.region])) };
    if (section === "wechat") return { source: uniqueOptions(entries.map((item) => [item.source.id, item.catalog && (item.catalog.source_name || item.source.id)])) };
    if (section === "standards") return {
      organization: uniqueOptions(entries.map((item) => [item.catalog && item.catalog.standard && item.catalog.standard.organization, item.catalog && item.catalog.standard && item.catalog.standard.organization])),
      stage: uniqueOptions(entries.map((item) => [item.catalog && item.catalog.standard && item.catalog.standard.stage, item.catalog && item.catalog.standard && STAGE_LABELS[item.catalog.standard.stage]])),
    };
    return {};
  }
  function uniqueOptions(pairs) {
    const values = new Map();
    for (const [value, label] of pairs) if (typeof value === "string" && value && typeof label === "string" && label) values.set(value, label);
    return [...values].sort((a, b) => a[1].localeCompare(b[1], "zh-CN")).map(([value, label]) => ({ value, label }));
  }
  function filterResult(snapshot, section, filters = {}) {
    const options = optionsFor(snapshot, section);
    const applicable = FILTERS[section] || [];
    const invalid = applicable.filter((key) => Object.hasOwn(filters, key) && !options[key].some((option) => option.value === filters[key]));
    const entries = invalid.length ? [] : collection(snapshot, section).filter((item) => {
      if (section === "policies" && filters.region && item.catalog.region !== filters.region) return false;
      if (section === "wechat" && filters.source && item.source.id !== filters.source) return false;
      if (section === "standards") {
        const standard = item.catalog && item.catalog.standard;
        if (filters.organization && (!standard || standard.organization !== filters.organization)) return false;
        if (filters.stage && (!standard || standard.stage !== filters.stage)) return false;
      }
      return true;
    });
    return { entries, options, invalid };
  }
  function searchText(item) {
    if (isBriefing(item)) return [item.title, item.summary, ...item.sections.flatMap((part) => [part.heading, part.body])].filter(Boolean).join(" ");
    const catalog = item.catalog;
    const standard = catalog && catalog.standard;
    return [item.title, item.intro, item.body, item.source.id, catalog && catalog.kind, catalog && catalog.source_name,
      catalog && catalog.source_channel, catalog && catalog.region, catalog && catalog.paper && catalog.paper.url,
      standard && standard.identifier, standard && standard.organization, standard && standard.stage,
      standard && STAGE_LABELS[standard.stage], standard && standard.as_of].filter(Boolean).join(" ");
  }
  function visibleEntries(snapshot, section, query, filters = {}) {
    const q = String(query || "").trim().toLocaleLowerCase();
    return filterResult(snapshot, section, filters).entries.filter((item) => !q || searchText(item).toLocaleLowerCase().includes(q));
  }
  function resolveSelection(snapshot, section, id, query, filters = {}) {
    const entries = visibleEntries(snapshot, section, query, filters);
    if (id) return entries.find((item) => item.id === id) || null;
    return entries[0] || null;
  }
  function paragraphs(text) {
    return plainText(text).split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
      .map((part) => `<p class="published-paragraph">${escapeHtml(part).replace(/\n/g, "<br>")}</p>`).join("");
  }
  function dateLabel(value) { return escapeHtml(dateKey(value)); }
  function timestampLabel(value) {
    const time = Date.parse(value);
    return Number.isFinite(time) ? escapeHtml(new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(time))) : dateLabel(value);
  }
  function articleSection(article) {
    if (articleKind(article) === "paper") return "papers";
    if (articleKind(article) === "policy") return "policies";
    if (articleKind(article) === "standard") return "standards";
    return "articles";
  }
  function internalArticleHref(article) { return `?${new URLSearchParams({ section: articleSection(article), id: article.id })}`; }
  function sourceLink(article, label, url = article.source.url) {
    const safeUrl = safeSourceUrl(url);
    if (!safeUrl) return "";
    return `<a class="text-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  }
  function renderArticle(article) {
    const catalog = article.catalog;
    const kind = articleKind(article);
    const detail = [];
    if (kind === "policy" && catalog && catalog.region) detail.push(`地区：${escapeHtml(catalog.region)}`);
    if (catalog && catalog.source_name) detail.push(`来源：${escapeHtml(catalog.source_name)}`);
    if (kind === "standard" && catalog && catalog.standard) {
      const standard = catalog.standard;
      if (standard.organization) detail.push(`组织：${escapeHtml(standard.organization)}`);
      if (standard.identifier) detail.push(`编号：${escapeHtml(standard.identifier)}`);
      if (standard.stage && standard.as_of) detail.push(`进展：${escapeHtml(STAGE_LABELS[standard.stage])} · 截至 ${dateLabel(standard.as_of)}`);
    }
    const paperUrl = kind === "paper" && catalog && catalog.paper ? catalog.paper.url : null;
    const paperLink = paperUrl ? sourceLink(article, "论文原文", paperUrl) : "";
    const sourceUrl = safeSourceUrl(article.source.url);
    const sourceLabel = catalog && catalog.source_channel === "wechat" ? "公众号原文" : "来源原文";
    const sourceLinkMarkup = kind === "paper"
      ? [paperLink, sourceUrl && sourceUrl !== safeSourceUrl(paperUrl) ? sourceLink(article, sourceLabel, sourceUrl) : ""].filter(Boolean).join(" · ")
      : sourceLink(article, "查看原文", sourceUrl);
    const sourceHost = article.source.url ? new URL(article.source.url).hostname.replace(/^www\./, "") : "";
    const isNews = article.format === "source_excerpt";
    return `<article class="article${isNews ? " published-news" : ""}"><h1 class="article-title">${escapeHtml(article.title)}</h1>
      <p class="published-meta">${isNews ? "原文发布时间：" : "发布日期："}${isNews ? timestampLabel(article.published_at) : dateLabel(article.published_at)}${detail.length ? ` · ${detail.join(" · ")}` : sourceHost ? ` · 来源：${escapeHtml(sourceHost)}` : ""}</p>
      ${sourceLinkMarkup ? `<p class="published-original">${sourceLinkMarkup}</p>` : ""}
      ${article.intro ? `<p class="published-intro">${isNews ? '<span class="published-news-label">原文摘要</span>' : kind === "paper" ? "论文简介：" : ""}${escapeHtml(article.intro)}</p>` : ""}${isNews ? "" : paragraphs(article.body)}</article>`;
  }
  function citationMarkup(section, articleMap) {
    const citations = [...new Set(section.article_ids)].map((id) => articleMap.get(id)).filter(Boolean);
    if (!citations.length) return "";
    return `<div class="published-citations" aria-label="相关已发布内容">${citations.map((article) => `<div class="published-citation">
      <a href="${escapeHtml(internalArticleHref(article))}">${escapeHtml(article.title)}</a>
      <small>发布日期：${dateLabel(article.published_at)}${sourceLink(article, " · 原文")}</small></div>`).join("")}</div>`;
  }
  function renderBriefing(briefing, snapshot) {
    const articleMap = new Map(snapshot.articles.map((article) => [article.id, article]));
    const citations = citationMarkup({ article_ids: [...new Set(briefing.sections.flatMap((section) => section.article_ids))] }, articleMap);
    return `<article class="article"><h1 class="article-title">${escapeHtml(briefing.title)}</h1>
      <p class="published-period">${dateLabel(briefing.start_date)} — ${dateLabel(briefing.end_date)}</p>
      ${briefing.summary ? `<p class="published-intro">${escapeHtml(briefing.summary)}</p>` : ""}
      ${briefing.sections.map((section) => `<section class="published-section"><h2>${escapeHtml(section.heading)}</h2>${paragraphs(section.body)}</section>`).join("")}
      ${citations ? `<section class="published-section"><h2>相关阅读与原文</h2>${citations}</section>` : ""}</article>`;
  }
  function listMarkup(entries, section, selectedId, state = {}) {
    if (!entries.length) return `<p class="published-empty">${section === "daily" || section === "weekly" || section === "monthly" ? "本期暂无已发布内容。" : "目前没有可阅读的内容。"}</p>`;
    return entries.map((item) => {
      const briefing = isBriefing(item);
      const targetSection = briefing ? item.period : section;
      const meta = briefing ? `${item.end_date} · ${SECTIONS[item.period].label}` : [item.format === "source_excerpt" ? timestampLabel(item.published_at) : dateKey(item.published_at), item.catalog && item.catalog.source_name].filter(Boolean).join(" · ");
      const id = item.id;
      const category = briefing ? "简报" : item.format === "source_excerpt" ? (articleKind(item) === "paper" ? "论文快讯" : "资讯快讯") : ({ paper: "论文", policy: "政策", standard: "标准" }[articleKind(item)] || "文章");
      const params = new URLSearchParams({ section: targetSection, id });
      if (state.q) params.set("q", state.q);
      for (const key of FILTERS[targetSection] || []) if (state.filters && state.filters[key]) params.set(key, state.filters[key]);
      const summary = briefing ? "" : item.intro;
      return `<a class="item-row${id === selectedId ? " selected" : ""}" href="${escapeHtml(`?${params}`)}" data-entry-id="${escapeHtml(id)}" data-entry-type="${briefing ? "briefing" : "article"}"${id === selectedId ? ' aria-current="true"' : ""}>
        <span class="item-meta">${escapeHtml(meta)}</span><span class="item-title">${escapeHtml(item.title)}</span><span class="item-kind">${category}</span>${summary ? `<span class="item-summary">${escapeHtml(summary)}</span>` : ""}</a>`;
    }).join("");
  }
  function readState(location) {
    const params = new URLSearchParams(location.search);
    const rawSection = params.get("section");
    const section = Object.hasOwn(SECTIONS, rawSection) ? rawSection : "latest";
    const filters = {};
    for (const key of ["region", "source", "organization", "stage"]) if (params.has(key)) filters[key] = params.get(key);
    return { section, id: params.get("id") || "", q: params.get("q") || "", filters, explicitId: params.has("id") };
  }
  function writeState(state, mode, win) {
    const params = new URLSearchParams({ section: state.section });
    if (state.id) params.set("id", state.id);
    if (state.q) params.set("q", state.q);
    for (const key of FILTERS[state.section] || []) if (state.filters && state.filters[key]) params.set(key, state.filters[key]);
    win.history[mode === "push" ? "pushState" : "replaceState"]({}, "", `${win.location.pathname}?${params}`);
  }
  function filterMarkup(section, options, filters) {
    const fields = FILTERS[section] || [];
    if (!fields.length) return "";
    const labels = { region: "地区", source: "公众号", organization: "组织", stage: "进展" };
    const controls = fields.map((key) => {
      const active = Object.hasOwn(filters, key);
      const valid = active && options[key].some((option) => option.value === filters[key]);
      const invalidOption = active && !valid ? `<option value="${escapeHtml(filters[key])}" selected>当前值不可用：${escapeHtml(filters[key]) || "空值"}</option>` : "";
      const choices = options[key].map((option) => `<option value="${escapeHtml(option.value)}"${filters[key] === option.value ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
      return `<div class="published-filter"><label for="published-filter-${key}">${labels[key]}</label><span class="published-filter-control"><select id="published-filter-${key}" data-filter="${key}" aria-label="按${labels[key]}筛选">${invalidOption}<option value="">全部${labels[key]}</option>${choices}</select><button type="button" data-clear-filter="${key}"${active ? "" : " disabled"}>清除</button></span></div>`;
    }).join("");
    return `<div class="reader-tools"><div class="published-filter-row">${controls}</div></div>`;
  }

  function boot(win) {
    const shell = win.document.getElementById("reader-shell");
    const heading = win.document.getElementById("collection-title");
    const subtitle = win.document.getElementById("collection-subtitle");
    const tools = win.document.getElementById("collection-tools");
    const list = win.document.getElementById("collection-list");
    const reader = win.document.getElementById("reading-content");
    if (!shell || !heading || !subtitle || !tools || !list || !reader) return;

    let snapshot = { articles: [], briefings: [] };
    let news = { updated_at: null, items: [] };
    let loadError = false;
    let mobileReading = Boolean(readState(win.location).id);
    let lastSelection = null;
    const panel = win.document.getElementById("reading-panel");
    const navigation = win.document.getElementById("primary-nav");
    function render() {
      const view = { ...snapshot, news };
      const state = readState(win.location);
      const result = filterResult(view, state.section, state.filters);
      const q = state.q.trim().toLocaleLowerCase();
      const entries = result.entries.filter((item) => !q || searchText(item).toLocaleLowerCase().includes(q));
      const selected = state.id ? entries.find((item) => item.id === state.id) || null : entries[0] || null;
      heading.textContent = SECTIONS[state.section].label;
      const countUnit = periodForSection(state.section) ? "期简报" : state.section === "latest" ? "条内容" : "条内容";
      subtitle.textContent = state.q ? `搜索：${state.q}` : `${entries.length} ${countUnit}`;
      if (!state.q && news.updated_at && ["latest", "articles", "papers", "discover"].includes(state.section)) {
        subtitle.textContent += ` · 收录更新 ${timestampLabel(news.updated_at)}`;
      }
      tools.innerHTML = `<label class="search-field"><img class="ui-icon" src="reader-assets/icons/search.svg" alt="" aria-hidden="true"><input type="search" data-search aria-label="搜索${SECTIONS[state.section].label}" placeholder="搜索${SECTIONS[state.section].label}" value="${escapeHtml(state.q)}"></label>${filterMarkup(state.section, result.options, state.filters)}`;
      list.innerHTML = loadError ? '<p class="published-empty published-error">暂时无法读取发布内容。</p>' : result.invalid.length ? '<p class="published-empty">筛选条件在当前栏目中没有匹配内容，请重新选择。</p>' : state.q && !entries.length ? '<p class="published-empty">没有找到匹配的内容。</p>' : listMarkup(entries, state.section, selected && selected.id, state);
      list.setAttribute("aria-busy", "false");
      reader.innerHTML = loadError ? '<p class="published-empty published-error">暂时无法读取发布内容。</p>' : selected ? (isBriefing(selected) ? renderBriefing(selected, view) : renderArticle(selected)) : `<p class="published-empty">${state.id ? "链接对应的内容当前不可用。" : state.q ? "没有找到匹配的内容。" : result.invalid.length ? "筛选条件在当前栏目中没有匹配内容。" : "目前没有可阅读的内容。"}</p>`;
      reader.setAttribute("aria-busy", "false");
      shell.classList.toggle("mobile-reading", mobileReading);
      if (panel && lastSelection !== (selected && selected.id)) panel.scrollTop = 0;
      lastSelection = selected && selected.id;
      win.document.querySelectorAll("[data-section]").forEach((link) => {
        if (link.dataset.section === state.section) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
      const search = tools.querySelector("[data-search]");
      search.addEventListener("input", () => {
        const current = readState(win.location);
        const id = search.value === current.q ? current.id : "";
        mobileReading = false;
        writeState({ ...current, q: search.value, id }, "replace", win);
        render();
        const next = tools.querySelector("[data-search]");
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      });
      tools.querySelectorAll("[data-filter]").forEach((control) => control.addEventListener("change", () => {
        const current = readState(win.location);
        const filters = { ...current.filters };
        if (control.value) filters[control.dataset.filter] = control.value;
        else delete filters[control.dataset.filter];
        mobileReading = false;
        writeState({ ...current, id: "", filters }, "push", win);
        render();
      }));
      tools.querySelectorAll("[data-clear-filter]").forEach((button) => button.addEventListener("click", () => {
        const current = readState(win.location);
        const filters = { ...current.filters };
        delete filters[button.dataset.clearFilter];
        mobileReading = false;
        writeState({ ...current, id: "", filters }, "push", win);
        render();
      }));
      list.querySelectorAll("[data-entry-id]").forEach((link) => link.addEventListener("click", (event) => {
        event.preventDefault();
        writeState({ ...readState(win.location), id: link.dataset.entryId }, "push", win);
        mobileReading = true;
        render();
        if (panel) panel.focus({ preventScroll: true });
      }));
    }
    win.document.querySelectorAll("[data-section]").forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      const section = link.dataset.section;
      writeState({ section, id: "", q: "", filters: {} }, "push", win);
      navigation.classList.remove("menu-open");
      mobileReading = false;
      const menu = win.document.querySelector("[data-menu]");
      if (menu) menu.setAttribute("aria-expanded", "false");
      render();
    }));
    const menu = win.document.querySelector("[data-menu]");
    if (menu) menu.addEventListener("click", () => {
      const open = navigation.classList.toggle("menu-open");
      menu.setAttribute("aria-expanded", String(open));
    });
    const back = win.document.querySelector("[data-back]");
    if (back) back.addEventListener("click", () => { mobileReading = false; shell.classList.remove("mobile-reading"); });
    win.addEventListener("popstate", () => { mobileReading = Boolean(readState(win.location).id); render(); });
    render();
    win.fetch("data.json", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("snapshot");
      return response.json();
    }).then((data) => { snapshot = normalizeSnapshot(data); render(); })
      .catch(() => { loadError = true; render(); });
    win.fetch("news.json", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("news");
      return response.json();
    }).then((data) => { news = normalizeNews(data); render(); }).catch(() => {});
  }

  return { SECTIONS, STAGE_LABELS, FILTERS, escapeHtml, safeSourceUrl, normalizeSnapshot, normalizeNews, projectCatalog, dateKey, articleKind, articleSection, collection, optionsFor, filterResult, visibleEntries, resolveSelection, paragraphs, readState, writeState, renderArticle, renderBriefing, listMarkup, filterMarkup, internalArticleHref, boot };
});
