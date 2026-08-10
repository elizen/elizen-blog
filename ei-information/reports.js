const state = {data: null, period: "daily"};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const PERIODS = {
  daily: {label: "日报", title: "今天的标准信号", start: (end) => end},
  weekly: {label: "周报", title: "近 7 天的标准信号", start: (end) => shiftDate(end, -6)},
  monthly: {label: "月报", title: "本月的标准信号", start: (end) => `${end.slice(0, 7)}-01`},
};

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
  const dates = (state.data?.projects || []).flatMap((project) => (project.events || []).map((event) => event.date?.slice(0, 10))).filter(Boolean).sort();
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

function uniqueProjects(signals) {
  return new Set(signals.map(({project}) => project.id)).size;
}

function upcomingDeadlines(window) {
  const end = shiftDate(window.end, 7);
  return new Set((state.data?.projects || []).filter((project) => project.deadline && project.deadline >= window.end && project.deadline <= end).map((project) => project.id)).size;
}

function reportData() {
  const window = currentWindow();
  const signals = collectSignals(window);
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
    highlights,
    topics: [...topics.entries()].sort((left, right) => right[1] - left[1]),
    statuses: [...statuses.entries()].sort((left, right) => right[1] - left[1]),
    metrics: {
      signals: signals.length,
      projects: uniqueProjects(signals),
      topics: topics.size,
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
  const labels = [["signals", "周期内信号", "条事件"], ["projects", "涉及项目", "个标准项目"], ["topics", "涉及领域", "个主题"], ["deadlines", "截止提醒", "7 天内"]];
  $("#report-metrics").innerHTML = labels.map(([key, label, note], index) => `<article class="briefing-metric ${index === 0 ? "primary" : ""}"><span>${label}</span><strong>${report.metrics[key]}</strong><small>${note}</small></article>`).join("");
}

function renderHighlights(report) {
  $("#report-highlights").innerHTML = report.highlights.length ? report.highlights.map(({project, event}) => `<article class="highlight-card">
    <div class="highlight-meta"><span class="signal-type">${escapeHtml(event.type || project.status || "标准事件")}</span><span>${escapeHtml(formatDate(event.date))}</span></div>
    <h4>${escapeHtml(project.title)}</h4>
    <p>${escapeHtml(signalSummary({project, event}))}</p>
    <div class="highlight-foot"><span>${escapeHtml((project.topics || []).join(" · ") || "未分类")}</span><span>${escapeHtml(event.source || project.source || "官方来源")}</span>${evidenceLink({project, event})}</div>
  </article>`).join("") : '<div class="report-empty">这个周期暂未捕获新的标准事件。</div>';
}

function renderDistribution(selector, entries) {
  const max = entries[0]?.[1] || 1;
  $(selector).innerHTML = entries.length ? entries.map(([label, count]) => `<div class="distribution-row"><div><span>${escapeHtml(label)}</span><b>${count}</b></div><i><em style="width:${Math.max(8, Math.round((count / max) * 100))}%"></em></i></div>`).join("") : '<div class="report-empty">暂无分布数据。</div>';
}

function renderTimeline(report) {
  $("#report-timeline").innerHTML = report.signals.length ? report.signals.map(({project, event}) => `<article class="timeline-row">
    <time>${escapeHtml(formatDate(event.date))}</time>
    <div><span class="signal-type">${escapeHtml(event.type || project.status || "标准事件")}</span><h4>${escapeHtml(project.title)}</h4><p>${escapeHtml(event.source || project.source || "官方来源")}</p></div>
    ${evidenceLink({project, event})}
  </article>`).join("") : '<div class="report-empty">这个周期没有可展示的事件。</div>';
}

function render() {
  if (!state.data) return;
  const report = reportData();
  const period = PERIODS[state.period];
  $("#report-period-label").textContent = period.label;
  $("#report-title").textContent = period.title;
  $("#report-summary").textContent = `${formatDate(report.window.start)} — ${formatDate(report.window.end)} · ${report.metrics.signals} 条正式事件进入本期简报。`;
  $("#report-anchor").textContent = `数据锚点 ${formatDate(anchorDate())}`;
  $$(`[data-period]`).forEach((button) => {
    const active = button.dataset.period === state.period;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });
  renderMetrics(report);
  renderHighlights(report);
  renderDistribution("#report-topics", report.topics);
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
  if (!response.ok) throw new Error("标准数据读取失败");
  state.data = await response.json();
  render();
}

const hashPeriod = location.hash.slice(1);
if (PERIODS[hashPeriod]) state.period = hashPeriod;
$$(`[data-period]`).forEach((button) => button.addEventListener("click", () => selectPeriod(button.dataset.period)));
window.addEventListener("hashchange", () => selectPeriod(location.hash.slice(1)));
loadData().catch((error) => { $("#report-highlights").innerHTML = `<div class="report-empty error-state">${escapeHtml(error.message)}</div>`; });
