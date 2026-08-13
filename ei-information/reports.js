const state = {data: null, period: "daily"};
const $ = (selector) => document.querySelector(selector);

const PERIODS = {
  daily: {label: "日报", eyebrow: "DAILY BRIEF", start: (end) => end},
  weekly: {label: "周报", eyebrow: "WEEKLY BRIEF", start: (end) => shiftDate(end, -6)},
  monthly: {label: "月报", eyebrow: "MONTHLY BRIEF", start: (end) => `${end.slice(0, 7)}-01`},
};
const MODULE_LABELS = {standard: "标准", policy: "政策", capital: "投融资", industry: "产业", technology: "技术", interpretation: "解读"};
const MODULE_PRIORITY = {policy: 0, standard: 1, capital: 2, industry: 3, technology: 4, interpretation: 5};
const MODULE_TITLES = {
  standard: "标准程序正在推进",
  policy: "政策信号进入执行层",
  capital: "产业资本继续寻找入口",
  industry: "企业动作开始变成产业进展",
  technology: "技术研究密集指向具身智能的下一步",
  interpretation: "解读正在补上政策与产业之间的空白",
};
const staticSite = Boolean(document.querySelector('meta[name="ei-radar-static"]'));

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>'"]/g, (char) => ({"&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;"}[char]));
}

function shiftDate(value, days) {
  const date = new Date(`${value}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

function formatDate(value) {
  if (!value) return "日期待确认";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("zh-CN", {month: "numeric", day: "numeric"}).format(date);
}

function formatLongDate(value) {
  if (!value) return "日期待确认";
  const date = new Date(`${value.slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(date.getTime())) return value.slice(0, 10);
  return new Intl.DateTimeFormat("zh-CN", {year: "numeric", month: "long", day: "numeric", weekday: "long"}).format(date);
}

function routePeriod() {
  const segment = location.pathname.split("/").filter(Boolean).at(-1)?.replace(/\.html$/, "");
  return PERIODS[segment] ? segment : "daily";
}

function anchorDate() {
  const checked = state.data?.checked_at;
  if (checked) return checked.slice(0, 10);
  const dates = [
    ...(state.data?.signals || []).map((signal) => signal.event_date?.slice(0, 10)),
    ...(state.data?.projects || []).flatMap((project) => (project.events || []).map((event) => event.date?.slice(0, 10))),
  ].filter(Boolean).sort();
  return dates.at(-1) || new Date().toISOString().slice(0, 10);
}

function currentWindow() {
  const end = anchorDate();
  const period = PERIODS[state.period];
  return {start: period.start(end), end};
}

function inWindow(value, window) {
  const date = value?.slice(0, 10);
  return Boolean(date && date >= window.start && date <= window.end);
}

function collectRadarSignals(window) {
  return (state.data?.signals || []).filter((signal) => inWindow(signal.event_date, window)).sort((left, right) => {
    const priority = (MODULE_PRIORITY[left.module] ?? 9) - (MODULE_PRIORITY[right.module] ?? 9);
    return priority || (right.event_date || "").localeCompare(left.event_date || "");
  });
}

function collectStandardEvents(window) {
  return (state.data?.projects || []).flatMap((project) => (project.events || [])
    .filter((event) => inWindow(event.date, window))
    .map((event) => ({project, event})))
    .sort((left, right) => (right.event.date || "").localeCompare(left.event.date || ""));
}

function editorial(signal, key, fallback) {
  return signal.metadata?.editorial?.[key] || fallback || signal.summary || "这条信号需要结合原文和其他来源继续判断。";
}

function signalSource(signal) {
  return signal.evidence?.[0]?.source_name || "公开来源";
}

function signalLink(signal) {
  return staticSite ? `signal.html?id=${encodeURIComponent(signal.id)}` : `/signals/${encodeURIComponent(signal.id)}`;
}

function signalDate(signal) {
  return signal.date_basis === "核查时间" ? "日期待确认" : formatDate(signal.event_date);
}

function standardStorySummary(story) {
  const description = (story.project.description || "").trim();
  if (description && description !== story.project.title) return description;
  return `“${story.project.title}”进入${story.event.type || "最新事件"}阶段，相关正式信息已收录进标准时间线。`;
}

function standardStorySource(story) {
  return story.event.source || story.project.source || "官方来源";
}

function standardStoryLink(story) {
  return story.event.source_url || story.project.source_url || "";
}

function buildBrief(signals, window) {
  if (!signals.length) return "本期暂未捕获新的产业信号，继续等待公开来源更新。";
  const undatedCount = signals.filter((signal) => signal.date_basis === "核查时间").length;
  const groups = buildThemeGroups(signals);
  const lead = signals[0];
  const leadIntro = editorial(lead, "intro", lead.summary);
  const clipped = leadIntro.length > 160 ? `${leadIntro.slice(0, 160)}…` : leadIntro;
  const windowLabel = undatedCount === signals.length ? "本次采集" : `${formatDate(window.start)}—${formatDate(window.end)}`;
  const dateNote = undatedCount ? `其中 ${undatedCount} 条发布日期待确认。` : "";
  return `${windowLabel}收录 ${signals.length} 条统一信号，主要集中在${groups.slice(0, 3).map((group) => group.label).join("、")}。${dateNote}${clipped}`;
}

function buildStandardBrief(stories, window) {
  if (!stories.length) return "本期暂未捕获新的产业信号，继续等待公开来源更新。";
  return `${formatDate(window.start)}—${formatDate(window.end)}收录 ${stories.length} 个标准事件。${standardStorySummary(stories[0])}`;
}

function buildMainLine(signals, window, standardEvents) {
  if (!signals.length) {
    if (standardEvents.length) {
      return {title: "标准程序进入新的节点", summary: buildStandardBrief(standardEvents, window)};
    }
    return {title: "本期暂未形成稳定主线", summary: "当前周期没有足够的公开信号形成判断，先保留来源与时间线，等待下一轮更新。"};
  }
  const groups = buildThemeGroups(signals);
  const lead = groups[0];
  const secondary = groups[1];
  const title = secondary
    ? `${MODULE_LABELS[lead.module] || lead.label}信号占主导，${MODULE_LABELS[secondary.module] || secondary.label}动态同步出现`
    : MODULE_TITLES[lead.module] || `${lead.label}成为本期主线`;
  return {title, summary: buildBrief(signals, window)};
}

function buildThemeGroups(signals) {
  const groups = new Map();
  signals.forEach((signal) => {
    const module = signal.module || "other";
    if (!groups.has(module)) groups.set(module, []);
    groups.get(module).push(signal);
  });
  return [...groups.entries()]
    .sort((left, right) => (right[1].length - left[1].length) || ((MODULE_PRIORITY[left[0]] ?? 9) - (MODULE_PRIORITY[right[0]] ?? 9)))
    .map(([module, items], index) => {
      const label = MODULE_LABELS[module] || module;
      const lead = items[0];
      const summary = editorial(lead, "intro", lead.summary);
      return {
        id: `theme-${module}`,
        index: String(index + 1).padStart(2, "0"),
        module,
        label,
        title: MODULE_TITLES[module] || `${label}信号集中出现`,
        summary: `${summary}${items.length > 1 ? ` 本组共 ${items.length} 条信号，继续沿着原文和后续事件核对。` : ""}`,
        signals: items,
      };
    });
}

function reportData() {
  const window = currentWindow();
  const radarSignals = collectRadarSignals(window);
  const standardEvents = collectStandardEvents(window);
  const signals = radarSignals.length ? radarSignals : standardEvents;
  const themeGroups = radarSignals.length ? buildThemeGroups(radarSignals) : [{
    id: "theme-standard",
    index: "01",
    module: "standard",
    label: "标准",
    title: "标准项目出现新的程序节点",
    summary: standardEvents.length ? standardStorySummary(standardEvents[0]) : "本期没有足够的标准事件形成主题段落。",
    signals: standardEvents,
  }];
  return {
    window,
    radarSignals,
    standardEvents,
    signals,
    themeGroups,
    mainLine: buildMainLine(radarSignals, window, standardEvents),
    brief: radarSignals.length ? buildBrief(radarSignals, window) : buildStandardBrief(standardEvents, window),
    metrics: {
      signals: signals.length,
      sources: new Set(radarSignals.flatMap((signal) => (signal.evidence || []).map((item) => item.source_name)).filter(Boolean)).size || (standardEvents.length ? new Set(standardEvents.map(standardStorySource)).size : 0),
      themes: themeGroups.length,
      days: new Set(signals.map((signal) => signal.event_date || signal.event?.date).filter(Boolean).map((date) => date.slice(0, 10))).size,
    },
  };
}

function renderPeriod(report) {
  const period = PERIODS[state.period];
  $("#report-period-label").textContent = period.label;
  $("#report-period-eyebrow").textContent = period.eyebrow;
  $("#report-range").textContent = state.period === "daily" ? formatLongDate(report.window.end) : `${report.window.start} — ${report.window.end}`;
  document.title = `EI Radar · ${period.label}`;
  document.querySelectorAll("[data-period]").forEach((link) => {
    const active = link.dataset.period === state.period;
    link.classList.toggle("active", active);
    link.setAttribute("aria-current", active ? "page" : "false");
  });
}

function renderLede(report) {
  $("#report-lede").innerHTML = `<p class="eyebrow accent">本期主线</p><h2>${escapeHtml(report.mainLine.title)}</h2><p>${escapeHtml(report.mainLine.summary)}</p><div class="report-lede-foot"><span>${escapeHtml(report.window.start)} — ${escapeHtml(report.window.end)}</span><span>${report.metrics.signals} 条统一信号 · ${report.metrics.sources} 个信源</span></div>`;
}

function renderMetrics(report) {
  const labels = [["signals", "统一信号", "本周期进入雷达的事实"], ["themes", "主题段落", "按模块归并阅读"], ["sources", "独立信源", "保留原文核对入口"], ["days", "覆盖日期", "有明确日期的信号日"]];
  $("#report-metrics").innerHTML = labels.map(([key, label, note], index) => `<article class="report-stat ${index === 0 ? "primary" : ""}"><span>${label}</span><strong>${report.metrics[key]}</strong><small>${note}</small></article>`).join("");
}

function renderContents(report) {
  $("#report-contents").innerHTML = report.themeGroups.length ? report.themeGroups.map((group) => `<a class="report-content-row" href="#${escapeHtml(group.id)}"><span>${group.index}</span><div><strong>${escapeHtml(group.title)}</strong><small>${escapeHtml(group.label)} · ${group.signals.length} 条</small></div><b>↘</b></a>`).join("") : '<div class="report-empty">本期暂无主题段落。</div>';
}

function radarCard(signal) {
  return `<article class="report-story-card"><div class="report-story-meta"><span>${escapeHtml(MODULE_LABELS[signal.module] || signal.module)} · ${escapeHtml(signal.signal_type || "行业信号")}</span><time>${escapeHtml(signalDate(signal))}</time></div><h3><a href="${escapeHtml(signalLink(signal))}">${escapeHtml(signal.title)}</a></h3><p>${escapeHtml(editorial(signal, "intro", signal.summary))}</p><div class="report-story-foot"><span>${escapeHtml(signalSource(signal))}</span><a href="${escapeHtml(signalLink(signal))}">读完整判断 ↗</a></div></article>`;
}

function standardCard(story) {
  const link = standardStoryLink(story);
  return `<article class="report-story-card"><div class="report-story-meta"><span>标准 · ${escapeHtml(story.event.type || story.project.status || "标准事件")}</span><time>${escapeHtml(formatDate(story.event.date))}</time></div><h3>${escapeHtml(story.project.title)}</h3><p>${escapeHtml(standardStorySummary(story))}</p><div class="report-story-foot"><span>${escapeHtml(standardStorySource(story))}</span>${link ? `<a href="${escapeHtml(link)}" target="_blank" rel="noreferrer">打开原文 ↗</a>` : ""}</div></article>`;
}

function renderThemes(report) {
  $("#report-themes").innerHTML = report.themeGroups.map((group) => `<section id="${escapeHtml(group.id)}" class="report-theme"><div class="report-theme-heading"><div><p class="eyebrow accent">${escapeHtml(group.index)} · ${escapeHtml(group.label)}</p><h2>${escapeHtml(group.title)}</h2></div><span>${group.signals.length} 条</span></div><p class="report-theme-summary">${escapeHtml(group.summary)}</p><div class="report-story-list">${group.signals.slice(0, 8).map((signal) => report.radarSignals.length ? radarCard(signal) : standardCard(signal)).join("")}</div>${group.signals.length > 8 ? `<p class="report-more-note">还有 ${group.signals.length - 8} 条信号，见下方来源与信号。</p>` : ""}</section>`).join("") || '<div class="report-empty">本期没有可展开的主题。</div>';
}

function renderSources(report) {
  const rows = report.radarSignals.length ? report.radarSignals : report.standardEvents;
  $("#report-sources").innerHTML = rows.length ? rows.map((item) => report.radarSignals.length
    ? `<article class="report-source-row"><time>${escapeHtml(signalDate(item))}</time><div><span>${escapeHtml(signalSource(item))}</span><h3><a href="${escapeHtml(signalLink(item))}">${escapeHtml(item.title)}</a></h3></div><a class="report-source-action" href="${escapeHtml(signalLink(item))}">查看 ↗</a></article>`
    : `<article class="report-source-row"><time>${escapeHtml(formatDate(item.event.date))}</time><div><span>${escapeHtml(standardStorySource(item))}</span><h3>${escapeHtml(item.project.title)}</h3></div>${standardStoryLink(item) ? `<a class="report-source-action" href="${escapeHtml(standardStoryLink(item))}" target="_blank" rel="noreferrer">原文 ↗</a>` : ""}</article>`).join("") : '<div class="report-empty">这个周期没有可展示的来源与信号。</div>';
}

function render() {
  if (!state.data) return;
  const report = reportData();
  renderPeriod(report);
  renderLede(report);
  renderMetrics(report);
  renderContents(report);
  renderThemes(report);
  renderSources(report);
}

async function loadData() {
  const response = await fetch(staticSite ? "api/data.json" : "api/data.json");
  if (!response.ok) throw new Error("产业数据读取失败");
  state.data = await response.json();
  render();
}

state.period = routePeriod();
loadData().catch((error) => { $("#report-lede").innerHTML = `<div class="report-empty error-state">${escapeHtml(error.message)}</div>`; });
