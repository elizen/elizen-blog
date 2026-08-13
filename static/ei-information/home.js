const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));

const moduleLabels = {
  standard: "标准",
  policy: "政策",
  capital: "投融资",
  industry: "产业",
  technology: "技术",
  interpretation: "解读",
};

const confidenceLabels = {
  confirmed: "已确认",
  corroborating: "待交叉核对",
  candidate: "候选线索",
};

const priority = {policy: 0, capital: 1, industry: 2, standard: 3, technology: 4, interpretation: 5};
const staticSite = Boolean(document.querySelector('meta[name="ei-radar-static"]'));

function signalHref(id) {
  return staticSite ? `signal.html?id=${encodeURIComponent(id)}` : `/signals/${encodeURIComponent(id)}`;
}

function topicHref(id) {
  return staticSite ? `topic.html?id=${encodeURIComponent(id)}` : `/topics/${encodeURIComponent(id)}`;
}

function signalIntro(signal) {
  return signal.metadata?.editorial?.intro || signal.summary || "这条信号还没有生成读者说明。";
}

function dateValue(signal) {
  return signal.event_date || signal.created_at || "";
}

function formatDate(value) {
  if (!value) return "日期待确认";
  return value.slice(0, 10).replace(/-/g, ".");
}

function sortedSignals(signals) {
  return [...signals].sort((left, right) => {
    const moduleDelta = (priority[left.module] ?? 9) - (priority[right.module] ?? 9);
    if (moduleDelta !== 0) return moduleDelta;
    return dateValue(right).localeCompare(dateValue(left));
  });
}

function signalCard(signal, featured = false) {
  const label = moduleLabels[signal.module] || signal.signal_type || "行业信号";
  return `<a class="feed-card ${featured ? "feed-card-featured" : ""}" href="${signalHref(signal.id)}">
    <div class="feed-card-marker"><span>${escapeHtml(label)}</span><time>${escapeHtml(formatDate(dateValue(signal)))}</time></div>
    <div class="feed-card-content"><h3>${escapeHtml(signal.title)}</h3><p>${escapeHtml(signalIntro(signal))}</p>
      <div class="feed-card-foot"><span class="confidence ${escapeHtml(signal.confidence)}">${escapeHtml(confidenceLabels[signal.confidence] || signal.confidence)}</span><span>${escapeHtml(signal.signal_type || "产业信号")}</span><b>打开简报 ↗</b></div>
    </div>
  </a>`;
}

function renderHotTopics(signals) {
  const items = sortedSignals(signals).slice(0, 3);
  document.querySelector("#hot-topics").innerHTML = items.length ? items.map((signal, index) => `<a class="hot-topic-row" href="${signalHref(signal.id)}"><span class="hot-topic-rank">${String(index + 1).padStart(2, "0")}</span><div><span class="hot-topic-label">${escapeHtml(moduleLabels[signal.module] || signal.signal_type || "行业信号")} · ${escapeHtml(formatDate(dateValue(signal)))}</span><h3>${escapeHtml(signal.title)}</h3><p>${escapeHtml(signalIntro(signal))}</p></div><span class="hot-topic-arrow">↗</span></a>`).join("") : '<div class="empty-state">当前暂无热点信号。</div>';
}

function renderSignalMix(signals) {
  const counts = new Map();
  signals.forEach((signal) => counts.set(signal.module, (counts.get(signal.module) || 0) + 1));
  const rows = [...counts.entries()].sort((left, right) => right[1] - left[1]);
  const max = rows[0]?.[1] || 1;
  document.querySelector("#home-signal-mix").innerHTML = rows.map(([module, count]) => `<div class="mix-row"><div><span>${escapeHtml(moduleLabels[module] || module)}</span><b>${count}</b></div><i><em style="width:${Math.max(9, Math.round((count / max) * 100))}%"></em></i></div>`).join("") || '<div class="sidebar-note">暂无信号分布。</div>';
}

function renderEvidenceMix(signals) {
  const counts = {confirmed: 0, corroborating: 0, candidate: 0};
  signals.forEach((signal) => { counts[signal.confidence] = (counts[signal.confidence] || 0) + 1; });
  document.querySelector("#home-evidence-mix").innerHTML = Object.entries(counts).filter(([, count]) => count).map(([confidence, count]) => `<div class="evidence-mix-row"><span class="confidence ${confidence}">${escapeHtml(confidenceLabels[confidence])}</span><strong>${count}</strong></div>`).join("");
}

function render(data) {
  const topic = data.topic || data.topics?.[0];
  const signals = data.signals || [];
  const sorted = sortedSignals(signals);
  document.querySelector("#home-anchor").textContent = (data.checked_at || sorted[0]?.event_date || "—").slice(0, 10).replace(/-/g, ".");
  document.querySelector("#home-source-count").textContent = `${(data.source_registry || []).length} 个`;
  document.querySelector("#today-highlights").innerHTML = sorted.slice(0, 9).map((signal) => signalCard(signal)).join("") || '<div class="empty-state">当前暂无可展示信号。</div>';
  document.querySelector("#home-topic-card").innerHTML = topic ? `<p class="eyebrow accent">CURRENT RADAR</p><h2>${escapeHtml(topic.name)}</h2><p>${escapeHtml(topic.description)}</p><div class="sidebar-topic-stats"><strong>${signals.length}</strong><span>条统一信号</span></div><a class="text-link" href="${topicHref(topic.id)}">进入主题雷达 ↗</a>` : '<div class="sidebar-note">暂无主题数据。</div>';
  renderHotTopics(signals);
  renderSignalMix(signals);
  renderEvidenceMix(signals);
}

fetch("api/radar.json").then((response) => { if (!response.ok) throw new Error("主题数据暂时无法读取"); return response.json(); }).then(render).catch((error) => {
  document.querySelector("#today-highlights").innerHTML = `<div class="empty-state error-state">${escapeHtml(error.message)}</div>`;
});
