const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));

const blockLabels = { standard: "标准", policy: "政策", capital: "资本", industry: "产业", technology: "技术", interpretation: "解读" };

function render(data) {
  const topic = data.topics.find((item) => item.id === "embodied-ai") || data.topics[0];
  const signals = data.signals || [];
  const projects = data.standard_projects || [];
  document.querySelector("#radar-overview").innerHTML = topic ? `
    <article class="overview-primary"><span>主题信号</span><strong>${signals.length}</strong><small>已接入统一证据模型</small></article>
    <article><span>标准项目</span><strong>${projects.length}</strong><small>现有标准模块</small></article>
    <article><span>政策信号</span><strong>${signals.filter((item) => item.module === "policy").length}</strong><small>官方文件优先</small></article>
    <article><span>来源目录</span><strong>${(data.source_registry || []).length}</strong><small>自动 / 人工分层</small></article>` : "";
  document.querySelector("#topic-cards").innerHTML = topic ? `<a class="topic-card topic-card-featured" href="/topics/${topic.id}">
    <div class="topic-card-index">01</div><div><p class="eyebrow accent">CHINA · TOPIC TIMELINE</p><h3>${escapeHtml(topic.name)}</h3><p>${escapeHtml(topic.description)}</p><div class="topic-card-meta"><span>${signals.length} 条已记录信号</span><span>${topic.blocks.map((block) => blockLabels[block] || block).join(" · ")}</span><b>进入主题 ↗</b></div></div></a>` : `<div class="empty-state">暂无主题数据</div>`;
}

fetch("api/radar").then((response) => response.json()).then(render).catch(() => {
  document.querySelector("#topic-cards").innerHTML = '<div class="empty-state error-state">主题数据暂时无法读取</div>';
});
