const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));

const labels = {standard: "标准", policy: "政策", capital: "投融资", industry: "产业", technology: "技术", interpretation: "解读"};
const confidenceLabels = {confirmed: "已确认", corroborating: "待交叉核对", candidate: "候选线索"};
const state = {data: null, query: "", module: "全部", confidence: "全部"};
const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function dateValue(signal) { return signal.event_date || signal.created_at || ""; }
function formatDate(value) { return value ? value.slice(0, 10).replace(/-/g, ".") : "日期待确认"; }

function visibleSignals() {
  return (state.data?.signals || []).filter((signal) => {
    const text = `${signal.title} ${signal.summary} ${signal.signal_type} ${JSON.stringify(signal.metadata || {})}`.toLowerCase();
    return (!state.query || text.includes(state.query.toLowerCase())) && (state.module === "全部" || signal.module === state.module) && (state.confidence === "全部" || signal.confidence === state.confidence);
  }).sort((left, right) => dateValue(right).localeCompare(dateValue(left)));
}

function card(signal) {
  return `<a class="feed-card" href="/signals/${encodeURIComponent(signal.id)}"><div class="feed-card-marker"><span>${escapeHtml(labels[signal.module] || signal.signal_type || "行业信号")}</span><time>${escapeHtml(formatDate(dateValue(signal)))}</time></div><div class="feed-card-content"><h3>${escapeHtml(signal.title)}</h3><p>${escapeHtml(signal.summary)}</p><div class="feed-card-foot"><span class="confidence ${escapeHtml(signal.confidence)}">${escapeHtml(confidenceLabels[signal.confidence] || signal.confidence)}</span><span>${escapeHtml(signal.signal_type || "行业信号")}</span><b>查看证据 ↗</b></div></div></a>`;
}

function render() {
  const signals = visibleSignals();
  $("#signal-result-title").textContent = state.query || state.module !== "全部" || state.confidence !== "全部" ? "筛选结果" : "最新信号";
  $("#signal-result-count").textContent = `${signals.length} 条`;
  $("#signal-feed").innerHTML = signals.length ? signals.map(card).join("") : '<div class="empty-state">没有符合条件的信号。换一个关键词或放宽筛选条件。</div>';
}

$("#signal-search").addEventListener("input", (event) => { state.query = event.target.value.trim(); render(); });
$$(`[data-module]`).forEach((button) => button.addEventListener("click", () => { state.module = button.dataset.module; $$(`[data-module]`).forEach((item) => item.classList.toggle("active", item === button)); render(); }));
$$(`[data-confidence]`).forEach((button) => button.addEventListener("click", () => { state.confidence = button.dataset.confidence; $$(`[data-confidence]`).forEach((item) => item.classList.toggle("active", item === button)); render(); }));

fetch("api/data").then((response) => { if (!response.ok) throw new Error("信号数据暂时无法读取"); return response.json(); }).then((data) => { state.data = data; render(); }).catch((error) => { $("#signal-feed").innerHTML = `<div class="empty-state error-state">${escapeHtml(error.message)}</div>`; });
