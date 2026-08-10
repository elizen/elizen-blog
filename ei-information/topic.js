const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;", "'":"&#39;"}[char]));
const labels = { standard: "标准", policy: "政策 / 揭榜挂帅", capital: "投融资", industry: "企业 / 产业", technology: "技术 / 研究", interpretation: "媒体解读" };
const pathParts = location.pathname.split("/").filter(Boolean);
const topicId = pathParts[pathParts.length - 1];

function signalCard(signal) {
  return `<a class="signal-card" href="/signals/${encodeURIComponent(signal.id)}"><div class="signal-card-top"><span>${escapeHtml(signal.signal_type)}</span><time>${escapeHtml(signal.event_date || "日期待核")}</time></div><h3>${escapeHtml(signal.title)}</h3><p>${escapeHtml(signal.summary)}</p><div class="signal-card-foot"><span class="confidence ${signal.confidence}">${escapeHtml(signal.confidence)}</span><b>查看证据 ↗</b></div></a>`;
}

fetch(`api/topics/${encodeURIComponent(topicId)}`).then((response) => { if (!response.ok) throw new Error("not found"); return response.json(); }).then((data) => {
  const { topic, signals, standard_projects } = data;
  document.title = `${topic.name} · EI Radar`;
  document.querySelector("#topic-header").innerHTML = `<p class="eyebrow accent">CHINA · TOPIC TIMELINE</p><h1>${escapeHtml(topic.name)}</h1><p>${escapeHtml(topic.description)}</p><div class="topic-header-meta"><span>${signals.length} 条统一信号</span><span>从标准、政策到产业与技术</span></div>`;
  document.querySelector("#topic-blocks").innerHTML = topic.blocks.map((block) => {
    const items = block === "standard" ? standard_projects.slice(0, 5).map((project) => `<a class="standard-mini-card" href="/standards"><span>标准项目</span><strong>${escapeHtml(project.title)}</strong><small>${escapeHtml(project.status || "状态待核")}</small></a>`).join("") : signals.filter((signal) => signal.module === block).slice(0, 5).map(signalCard).join("");
    return `<section class="topic-block"><div class="topic-block-heading"><div><p class="eyebrow">${block.toUpperCase()}</p><h2>${labels[block] || block}</h2></div><span>${block === "standard" ? standard_projects.length : signals.filter((signal) => signal.module === block).length} 条</span></div><div class="topic-block-grid">${items || '<div class="block-empty">暂未形成稳定信号</div>'}</div></section>`;
  }).join("");
}).catch(() => { document.querySelector("#topic-header").innerHTML = '<div class="empty-state error-state">主题不存在或暂时无法读取</div>'; });
