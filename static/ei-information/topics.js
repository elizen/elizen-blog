const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;", "'":"&#39;"}[char]));
const staticSite = Boolean(document.querySelector('meta[name="ei-radar-static"]'));
const topicHref = (id) => staticSite ? `topic.html?id=${encodeURIComponent(id)}` : `/topics/${encodeURIComponent(id)}`;
fetch("api/topics").then((response) => response.json()).then((data) => {
  document.querySelector("#topic-index").innerHTML = (data.topics || []).filter((topic) => topic.enabled).map((topic, index) => `<a class="topic-index-card" href="${topicHref(topic.id)}"><span class="topic-number">${String(index + 1).padStart(2, "0")}</span><div><p class="eyebrow">${topic.region || "CHINA"} · TOPIC</p><h2>${escapeHtml(topic.name)}</h2><p>${escapeHtml(topic.description)}</p><span class="topic-enter">查看主题时间线 ↗</span></div></a>`).join("") || '<div class="empty-state">暂无公开主题</div>';
}).catch(() => { document.querySelector("#topic-index").innerHTML = '<div class="empty-state error-state">主题索引暂时无法读取</div>'; });
