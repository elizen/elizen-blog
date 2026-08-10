const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;", "\"":"&quot;", "'":"&#39;"}[char]));
fetch("api/sources").then((response) => response.json()).then((data) => {
  const sources = data.sources || [];
  document.querySelector("#source-count").textContent = `${sources.length} 个来源`;
  document.querySelector("#source-list").innerHTML = sources.map((source) => `<article class="source-row"><div><span class="source-tier">${escapeHtml(source.tier)}</span><h3>${escapeHtml(source.name)}</h3><p>${escapeHtml(source.coverage)}</p></div><div class="source-row-meta"><span>${escapeHtml(source.collection)}</span><span>${escapeHtml(source.evidence_policy)}</span>${source.homepage ? `<a href="${escapeHtml(source.homepage)}" target="_blank" rel="noreferrer">打开入口 ↗</a>` : "<small>官方入口待确认</small>"}</div></article>`).join("") || '<div class="empty-state">暂无来源目录</div>';
}).catch(() => { document.querySelector("#source-list").innerHTML = '<div class="empty-state error-state">来源目录暂时无法读取</div>'; });
