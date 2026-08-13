const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const labels = {standard: "标准", policy: "政策", capital: "投融资", industry: "产业", technology: "技术", interpretation: "解读"};
const confidenceLabels = {confirmed: "已确认", corroborating: "待交叉核对", candidate: "候选线索"};
const pathParts = location.pathname.split("/").filter(Boolean);
const staticSite = Boolean(document.querySelector('meta[name="ei-radar-static"]'));
const topicId = staticSite ? new URLSearchParams(location.search).get("id") : pathParts[pathParts.length - 1];

function signalHref(id) {
  return staticSite ? `signal.html?id=${encodeURIComponent(id)}` : `/signals/${encodeURIComponent(id)}`;
}

function signalDate(signal) { return signal.event_date ? signal.event_date.slice(0, 10).replace(/-/g, ".") : "日期待确认"; }
function signalIntro(signal) { return signal.metadata?.editorial?.intro || signal.summary || "这条信号还没有生成读者说明。"; }

function signalCard(signal) {
  return `<a class="feed-card topic-feed-card" href="${signalHref(signal.id)}"><div class="feed-card-marker"><span>${escapeHtml(labels[signal.module] || signal.signal_type || "行业信号")}</span><time>${escapeHtml(signalDate(signal))}</time></div><div class="feed-card-content"><h3>${escapeHtml(signal.title)}</h3><p>${escapeHtml(signalIntro(signal))}</p><div class="feed-card-foot"><span class="confidence ${escapeHtml(signal.confidence)}">${escapeHtml(confidenceLabels[signal.confidence] || signal.confidence)}</span><span>${escapeHtml(signal.signal_type || "行业信号")}</span><b>打开简报 ↗</b></div></div></a>`;
}

function renderSidebar(topic, signals, standardProjects) {
  const confidence = {confirmed: 0, corroborating: 0, candidate: 0};
  signals.forEach((signal) => { confidence[signal.confidence] = (confidence[signal.confidence] || 0) + 1; });
  const moduleRows = topic.blocks.map((block) => [block, block === "standard" ? standardProjects.length : signals.filter((signal) => signal.module === block).length]);
  document.querySelector("#topic-sidebar").innerHTML = `<section class="sidebar-card sidebar-topic-card"><p class="eyebrow accent">TOPIC RADAR</p><h2>${escapeHtml(topic.name)}</h2><p>${escapeHtml(topic.description)}</p><div class="sidebar-topic-stats"><strong>${signals.length}</strong><span>条统一信号</span></div></section><section class="sidebar-card"><div class="sidebar-heading"><p class="eyebrow">SIGNAL MIX</p><span>主题分布</span></div><div class="mix-list">${moduleRows.map(([block, count]) => `<div class="mix-row"><div><span>${escapeHtml(labels[block] || block)}</span><b>${count}</b></div><i><em style="width:${Math.max(7, Math.round((count / Math.max(...moduleRows.map(([, value]) => value), 1)) * 100))}%"></em></i></div>`).join("")}</div></section><section class="sidebar-card"><div class="sidebar-heading"><p class="eyebrow">EVIDENCE</p><span>可信度</span></div><div class="evidence-mix">${Object.entries(confidence).filter(([, count]) => count).map(([key, count]) => `<div class="evidence-mix-row"><span class="confidence ${key}">${escapeHtml(confidenceLabels[key])}</span><strong>${count}</strong></div>`).join("")}</div><p class="sidebar-note">主题页展示趋势，详情页保留每一条原始证据。</p></section><section class="sidebar-card sidebar-standards-card"><p class="eyebrow">STANDARD RADAR</p><h3>${standardProjects.length} 个相关标准项目</h3><p>从拟立项到发布，标准状态单独保留完整时间线。</p><a class="text-link" href="/standards">查看标准库 ↗</a></section>`;
}

fetch(`api/topic/${encodeURIComponent(topicId)}.json`).then((response) => { if (!response.ok) throw new Error("主题不存在"); return response.json(); }).then((data) => {
  const {topic, signals, standard_projects: standardProjects} = data;
  document.title = `${topic.name} · EI Radar`;
  document.querySelector("#topic-header").innerHTML = `<p class="eyebrow accent">TOPIC TIMELINE · ${escapeHtml(topic.region || "CHINA")}</p><h1>${escapeHtml(topic.name)}</h1><p>${escapeHtml(topic.description)}</p><div class="topic-header-meta"><span>${signals.length} 条统一信号</span><span>${standardProjects.length} 个相关标准项目</span><span>政策 · 标准 · 资本 · 企业 · 技术</span></div>`;
  document.querySelector("#topic-blocks").innerHTML = topic.blocks.map((block) => {
    const items = block === "standard" ? standardProjects.slice(0, 6).map((project) => `<a class="standard-mini-card" href="/standards"><span>标准项目</span><strong>${escapeHtml(project.title)}</strong><small>${escapeHtml(project.status || "状态待核")}</small></a>`).join("") : signals.filter((signal) => signal.module === block).slice(0, 8).map(signalCard).join("");
    const count = block === "standard" ? standardProjects.length : signals.filter((signal) => signal.module === block).length;
    return `<section class="topic-block"><div class="topic-block-heading"><div><p class="eyebrow">${escapeHtml(block.toUpperCase())}</p><h2>${escapeHtml(labels[block] || block)}</h2></div><span>${count} 条</span></div><div class="topic-block-grid ${block === "standard" ? "standard-grid" : "topic-feed-list"}">${items || '<div class="block-empty">暂未形成稳定信号</div>'}</div></section>`;
  }).join("");
  renderSidebar(topic, signals, standardProjects);
}).catch((error) => { document.querySelector("#topic-header").innerHTML = `<div class="empty-state error-state">${escapeHtml(error.message)}</div>`; });
