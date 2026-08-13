const state = {data: null, period: "daily"};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const PERIODS = {
  daily: {label: "日报", title: "今天的产业信号", start: (end) => end},
  weekly: {label: "周报", title: "近 7 天的产业信号", start: (end) => shiftDate(end, -6)},
  monthly: {label: "月报", title: "本月的产业信号", start: (end) => `${end.slice(0, 7)}-01`},
};
const MODULE_LABELS = {standard: "标准", policy: "政策", capital: "投融资", industry: "产业", technology: "技术", interpretation: "解读"};
const MODULE_PRIORITY = {policy: 0, standard: 1, capital: 2, industry: 3, technology: 4, interpretation: 5};
const REPORT_COPY = {judgment: "本期判断", why: "为什么值得看", next: "接下来观察"};

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

function collectSignals(window) {
  return (state.data?.projects || []).flatMap((project) => (project.events || []).filter((event) => inWindow(event.date, window)).map((event) => ({project, event}))).sort((left, right) => (right.event.date || "").localeCompare(left.event.date || ""));
}

function collectRadarSignals(window) {
  return (state.data.signals || []).filter((signal) => inWindow(signal.event_date, window)).sort((left, right) => {
    const priority = (MODULE_PRIORITY[left.module] ?? 9) - (MODULE_PRIORITY[right.module] ?? 9);
    return priority || (right.event_date || "").localeCompare(left.event_date || "");
  });
}

function uniqueProjects(signals) {
  return new Set(signals.map(({project}) => project.id)).size;
}

function upcomingDeadlines(window) {
  const end = shiftDate(window.end, 7);
  return new Set((state.data?.projects || []).filter((project) => project.deadline && project.deadline >= window.end && project.deadline <= end).map((project) => project.id)).size;
}

function editorial(signal, key, fallback) {
  return signal.metadata?.editorial?.[key] || fallback || signal.summary || "这条信号需要结合原文和其他来源继续判断。";
}

function signalSource(signal) {
  return signal.evidence?.[0]?.source_name || "公开来源";
}

function signalLink(signal) {
  return `/signals/${encodeURIComponent(signal.id)}`;
}

function signalDate(signal) {
  return signal.date_basis === "核查时间" ? "日期待确认" : formatDate(signal.event_date);
}

function radarModuleEntries(signals) {
  const counts = new Map();
  signals.forEach((signal) => counts.set(signal.module, (counts.get(signal.module) || 0) + 1));
  return [...counts.entries()].sort((left, right) => right[1] - left[1]).map(([module, count]) => [MODULE_LABELS[module] || module, count]);
}

function buildBrief(radarSignals, window) {
  if (!radarSignals.length) return "本期暂未捕获新的产业信号，继续等待公开来源更新。";
  const undatedCount = radarSignals.filter((signal) => signal.date_basis === "核查时间").length;
  const modules = radarModuleEntries(radarSignals).slice(0, 3).map(([label]) => label);
  const lead = radarSignals[0];
  const leadIntro = editorial(lead, "intro", lead.summary);
  const clipped = leadIntro.length > 92 ? `${leadIntro.slice(0, 92)}…` : leadIntro;
  const windowLabel = undatedCount === radarSignals.length ? "本次采集" : `${formatDate(window.start)}—${formatDate(window.end)}`;
  const dateNote = undatedCount ? `其中 ${undatedCount} 条发布日期待确认，不计作已发生事件。` : "";
  return `${windowLabel}收录 ${radarSignals.length} 条产业信号，主要集中在${modules.join("、")}。${dateNote}优先看“${lead.title}”：${clipped}`;
}

function buildWhy(radarSignals) {
  return radarSignals.slice(0, 3).map((signal) => ({
    title: signal.title,
    text: editorial(signal, "why_it_matters", signal.summary),
    href: signalLink(signal),
    module: MODULE_LABELS[signal.module] || signal.module,
  }));
}

function buildNextSteps(radarSignals) {
  const steps = [];
  const push = (module, text) => { if (radarSignals.some((signal) => signal.module === module) && !steps.includes(text)) steps.push(text); };
  push("policy", "跟踪实施细则、申报窗口和后续配套文件");
  push("technology", "核对论文实验、开源实现和真实场景验证");
  push("industry", "观察产品验证、客户场景和规模化交付证据");
  push("capital", "核对公司或投资方一级披露，并观察融资后的业务进展");
  push("standard", "跟踪征求意见、发布和实施节点");
  if (!steps.length) steps.push("打开重点信号的原文，继续等待独立来源交叉验证");
  return steps.slice(0, 4);
}

function reportData() {
  const window = currentWindow();
  const signals = collectSignals(window);
  const radarSignals = collectRadarSignals(window);
  const highlights = [];
  const highlightIds = new Set();
  signals.forEach((signal) => {
    if (highlights.length >= 3 || highlightIds.has(signal.project.id)) return;
    highlightIds.add(signal.project.id);
    highlights.push(signal);
  });
  const topics = new Map();
  const statuses = new Map();
  signals.forEach(({project, event}) => {
    const projectTopics = project.topics?.length ? project.topics : ["未分类"];
    projectTopics.forEach((topic) => topics.set(topic, (topics.get(topic) || 0) + 1));
    const type = event.type || project.status || "未分类";
    statuses.set(type, (statuses.get(type) || 0) + 1);
  });
  return {
    window,
    signals,
    radarSignals,
    highlights,
    topics: [...topics.entries()].sort((left, right) => right[1] - left[1]),
    statuses: [...statuses.entries()].sort((left, right) => right[1] - left[1]),
    radarModules: radarModuleEntries(radarSignals),
    brief: buildBrief(radarSignals, window),
    why: buildWhy(radarSignals),
    nextSteps: buildNextSteps(radarSignals),
    metrics: {
      signals: radarSignals.length || signals.length,
      projects: uniqueProjects(signals),
      topics: radarModuleEntries(radarSignals).length || topics.size,
      deadlines: upcomingDeadlines(window),
    },
  };
}

function evidenceLink(signal) {
  const url = signal.event.source_url || signal.project.source_url;
  return url ? `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">打开官方原文 ↗</a>` : "";
}

function signalSummary(signal) {
  const description = (signal.project.description || "").trim();
  if (description && description !== signal.project.title) return description;
  return `“${signal.project.title}”进入${signal.event.type || "最新事件"}阶段，相关正式信息已收录进标准时间线。`;
}

function renderMetrics(report) {
  const labels = [["signals", "周期内信号", "条信号（含待核日期）"], ["projects", "涉及标准项目", "个项目"], ["topics", "信号模块", "个模块"], ["deadlines", "截止提醒", "7 天内"]];
  $("#report-metrics").innerHTML = labels.map(([key, label, note], index) => `<article class="briefing-metric ${index === 0 ? "primary" : ""}"><span>${label}</span><strong>${report.metrics[key]}</strong><small>${note}</small></article>`).join("");
}

function renderRadarHighlights(report) {
  $("#report-highlights").innerHTML = report.radarSignals.length ? report.radarSignals.slice(0, 6).map((signal) => `<article class="highlight-card radar-highlight-card"><div class="highlight-meta"><span class="signal-type">${escapeHtml(MODULE_LABELS[signal.module] || signal.module)} · ${escapeHtml(signal.signal_type)}</span><span>${escapeHtml(signalDate(signal))}</span></div><h4><a href="${escapeHtml(signalLink(signal))}">${escapeHtml(signal.title)}</a></h4><p>${escapeHtml(editorial(signal, "intro", signal.summary))}</p><div class="highlight-foot"><span>${escapeHtml(signalSource(signal))}</span><span>${escapeHtml(signal.confidence || "待核对")}</span><a href="${escapeHtml(signalLink(signal))}">读判断 ↗</a></div></article>`).join("") : renderStandardHighlights(report);
}

function renderStandardHighlights(report) {
  return report.highlights.length ? report.highlights.map(({project, event}) => `<article class="highlight-card"><div class="highlight-meta"><span class="signal-type">${escapeHtml(event.type || project.status || "标准事件")}</span><span>${escapeHtml(formatDate(event.date))}</span></div><h4>${escapeHtml(project.title)}</h4><p>${escapeHtml(signalSummary({project, event}))}</p><div class="highlight-foot"><span>${escapeHtml((project.topics || []).join(" · ") || "未分类")}</span><span>${escapeHtml(event.source || project.source || "官方来源")}</span>${evidenceLink({project, event})}</div></article>`).join("") : '<div class="report-empty">这个周期暂未捕获新的公开事件。</div>';
}

function renderWhy(report) {
  $("#report-why").innerHTML = report.why.length ? report.why.map((item) => `<a class="report-why-item" href="${escapeHtml(item.href)}"><span>${escapeHtml(item.module)}</span><strong>${escapeHtml(item.title)}</strong><p>${escapeHtml(item.text)}</p></a>`).join("") : '<p class="report-empty">本期还没有足够信号形成编辑判断。</p>';
}

function renderNextSteps(report) {
  $("#report-next-steps").innerHTML = report.nextSteps.map((step) => `<li>${escapeHtml(step)}</li>`).join("");
}

function renderDistribution(selector, entries) {
  const max = entries[0]?.[1] || 1;
  $(selector).innerHTML = entries.length ? entries.map(([label, count]) => `<div class="distribution-row"><div><span>${escapeHtml(label)}</span><b>${count}</b></div><i><em style="width:${Math.max(8, Math.round((count / max) * 100))}%"></em></i></div>`).join("") : '<div class="report-empty">暂无分布数据。</div>';
}

function renderTimeline(report) {
  if (report.radarSignals.length) {
    $("#report-timeline").innerHTML = report.radarSignals.map((signal) => `<article class="timeline-row"><time>${escapeHtml(signalDate(signal))}</time><div><span class="signal-type">${escapeHtml(MODULE_LABELS[signal.module] || signal.module)}</span><h4><a href="${escapeHtml(signalLink(signal))}">${escapeHtml(signal.title)}</a></h4><p>${escapeHtml(signalSource(signal))}</p></div><a href="${escapeHtml(signalLink(signal))}">查看 ↗</a></article>`).join("");
    return;
  }
  $("#report-timeline").innerHTML = report.signals.length ? report.signals.map(({project, event}) => `<article class="timeline-row"><time>${escapeHtml(formatDate(event.date))}</time><div><span class="signal-type">${escapeHtml(event.type || project.status || "标准事件")}</span><h4>${escapeHtml(project.title)}</h4><p>${escapeHtml(event.source || project.source || "官方来源")}</p></div>${evidenceLink({project, event})}</article>`).join("") : '<div class="report-empty">这个周期没有可展示的事件。</div>';
}

function render() {
  if (!state.data) return;
  const report = reportData();
  const period = PERIODS[state.period];
  $("#report-period-label").textContent = period.label;
  $("#report-title").textContent = period.title;
  $("#report-summary").setAttribute("aria-label", REPORT_COPY.judgment);
  $("#report-summary").textContent = report.brief;
  $("#report-anchor").textContent = `数据锚点 ${formatDate(anchorDate())}`;
  $$(`[data-period]`).forEach((button) => {
    const active = button.dataset.period === state.period;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  $("#report-why").setAttribute("aria-label", REPORT_COPY.why);
  $("#report-next-steps").setAttribute("aria-label", REPORT_COPY.next);
  renderWhy(report);
  renderNextSteps(report);
  renderMetrics(report);
  renderRadarHighlights(report);
  renderDistribution("#report-topics", report.radarModules.length ? report.radarModules : report.topics);
  renderDistribution("#report-statuses", report.statuses);
  renderTimeline(report);
}

function selectPeriod(period) {
  if (!PERIODS[period]) return;
  state.period = period;
  location.hash = period;
  render();
}

async function loadData() {
  const response = await fetch("api/data");
  if (!response.ok) throw new Error("产业数据读取失败");
  state.data = await response.json();
  render();
}

const hashPeriod = location.hash.slice(1);
if (PERIODS[hashPeriod]) state.period = hashPeriod;
$$(`[data-period]`).forEach((button) => button.addEventListener("click", () => selectPeriod(button.dataset.period)));
window.addEventListener("hashchange", () => selectPeriod(location.hash.slice(1)));
loadData().catch((error) => { $("#report-highlights").innerHTML = `<div class="report-empty error-state">${escapeHtml(error.message)}</div>`; });
