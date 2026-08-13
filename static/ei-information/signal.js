const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({"&":"&amp;","<":"&lt;",">":"&gt;","\"":"&quot;","'":"&#39;"}[char]));
const signalId = decodeURIComponent(location.pathname.split("/").filter(Boolean).pop() || "");
const evidenceLabels = {primary: "官方原文", corroboration: "核对来源", interpretation: "观点解读"};
const confidenceLabels = {confirmed: "已确认", corroborating: "待交叉核对", candidate: "候选线索"};
const metadataLabels = {entity: "企业", amount: "金额", round: "轮次", use: "资金用途", financing_date: "融资日期", verification_status: "核验状态"};
const moduleLabels = {standard: "标准", policy: "政策", capital: "投融资", industry: "产业", technology: "技术", interpretation: "解读"};
const readerLabels = {
  standard: ["STANDARD NOTE", "标准说明"],
  policy: ["POLICY NOTE", "政策要点"],
  capital: ["CAPITAL NOTE", "融资说明"],
  industry: ["INDUSTRY NOTE", "产业说明"],
  technology: ["TECHNOLOGY NOTE", "技术说明"],
  interpretation: ["INTERPRETATION", "解读摘要"],
};

function nextAction(signal) {
  const editorial = signal.metadata?.editorial || {};
  if (editorial.watch_next) return editorial.watch_next;
  if (signal.confidence === "confirmed") return "继续跟踪后续事件和关联标准";
  if (signal.confidence === "corroborating") return "打开核对来源，回到原文确认";
  return "把它留在候选池，等待一级证据";
}

function whoShouldCare(signal) {
  if (signal.module === "standard") return "标准组织、企业研发与合规团队";
  if (signal.module === "capital") return "产业投资人、创业团队与供应链企业";
  if (signal.module === "technology") return "研究者、算法团队与产品工程师";
  if (signal.module === "policy") return "政府部门、标准组织与产业参与者";
  return "关注具身智能产业进展的读者";
}

function editorial(signal) {
  return signal.metadata?.editorial || {};
}

function primaryEvidence(signal) {
  const evidence = signal.evidence || [];
  return evidence.find((item) => item.evidence_role === "primary") || evidence[0] || {};
}

function eventDateLabel(signal) {
  return signal.date_basis === "核查时间" ? "日期待确认" : (signal.event_date || "日期待确认");
}

function readingSections(signal) {
  const insight = editorial(signal);
  const evidence = primaryEvidence(signal);
  const isPaper = signal.module === "technology" && (signal.signal_type === "研究发布" || evidence.source_name === "arXiv具身智能论文");
  const [readingEyebrow, readingTitle] = isPaper ? ["PAPER INTRODUCTION", "论文介绍"] : (readerLabels[signal.module] || ["SIGNAL NOTE", "信号说明"]);
  const sourceExcerpt = evidence.excerpt || "原文未提供可抽取摘要，请打开原文核对研究内容。";
  const intro = insight.intro || signal.summary || "这条信号还没有生成读者说明。";
  const whyItMatters = insight.why_it_matters || signal.summary || "这条信号需要结合原文和其他来源继续判断。";
  return `<section class="signal-reading" aria-label="信号解读"><div class="signal-reading-heading"><p class="eyebrow">READER TAKEAWAY</p><h2>先把这条信号读懂。</h2></div><article class="reading-lead"><p class="eyebrow accent">一句话判断</p><p>${escapeHtml(intro)}</p></article><div class="reading-grid"><article class="reading-card paper-introduction"><div class="sidebar-heading"><p class="eyebrow">${readingEyebrow}</p><span>${readingTitle}</span></div><p>${escapeHtml(sourceExcerpt)}</p><small>${escapeHtml(evidence.source_name || "公开来源")} · ${isPaper ? "原始摘要摘录" : "来源摘录"}</small></article><article class="reading-card why-it-matters"><div class="sidebar-heading"><p class="eyebrow">WHY IT MATTERS</p><span>为什么值得看</span></div><p>${escapeHtml(whyItMatters)}</p></article></div></section>`;
}

function renderSidebar(signal) {
  const evidence = signal.evidence || [];
  const insight = editorial(signal);
  const whyItMatters = insight.why_it_matters || signal.summary || "这条信号需要结合原文和其他来源继续判断。";
  document.querySelector("#signal-sidebar").innerHTML = `<section class="sidebar-card sidebar-topic-card"><p class="eyebrow accent">DECISION BRIEF</p><span class="confidence large ${escapeHtml(signal.confidence)}">${escapeHtml(confidenceLabels[signal.confidence] || signal.confidence)}</span><h2>${escapeHtml(moduleLabels[signal.module] || signal.signal_type || "行业信号")}</h2><p>${escapeHtml(eventDateLabel(signal))} · ${escapeHtml(signal.date_basis || "日期依据待确认")}</p></section><section class="sidebar-card"><div class="sidebar-heading"><p class="eyebrow">WHY IT MATTERS</p><span>产业意义</span></div><p class="brief-text">${escapeHtml(whyItMatters)}</p></section><section class="sidebar-card"><div class="sidebar-heading"><p class="eyebrow">WHO SHOULD CARE</p><span>相关角色</span></div><p class="brief-text">${escapeHtml(whoShouldCare(signal))}</p></section><section class="sidebar-card sidebar-standards-card"><p class="eyebrow">NEXT SIGNAL</p><h3>${escapeHtml(nextAction(signal))}</h3><p>${evidence.length} 条证据已挂接到这条信号。</p></section>`;
}

fetch(`api/signals/${encodeURIComponent(signalId)}`).then((response) => { if (!response.ok) throw new Error("信号不存在"); return response.json(); }).then(({signal}) => {
  document.title = `${signal.title} · EI Radar`;
  const metadata = Object.entries(signal.metadata || {}).filter(([key, value]) => key !== "editorial" && value !== "" && value != null).map(([key, value]) => `<div><span>${escapeHtml(metadataLabels[key] || key)}</span><strong>${escapeHtml(Array.isArray(value) ? value.join("、") : value)}</strong></div>`).join("");
  const evidence = signal.evidence || [];
  document.querySelector("#signal-detail").innerHTML = `<header class="signal-detail-head"><div><p class="eyebrow accent">${escapeHtml(moduleLabels[signal.module] || signal.module)} · ${escapeHtml(signal.signal_type)}</p><h1>${escapeHtml(signal.title)}</h1></div><span class="confidence large ${escapeHtml(signal.confidence)}">${escapeHtml(confidenceLabels[signal.confidence] || signal.confidence)}</span></header>${readingSections(signal)}<section class="signal-facts"><div><span>事件日期</span><strong>${escapeHtml(eventDateLabel(signal))}</strong></div><div><span>日期依据</span><strong>${escapeHtml(signal.date_basis || "待核")}</strong></div><div><span>证据数量</span><strong>${evidence.length} 条</strong></div></section>${metadata ? `<section class="signal-facts structured-facts"><div class="topic-block-heading"><div><p class="eyebrow">STRUCTURED EVENT</p><h2>结构化字段</h2></div></div>${metadata}</section>` : ""}<section class="signal-evidence-section"><div class="topic-block-heading"><div><p class="eyebrow">EVIDENCE TIMELINE</p><h2>证据时间线</h2></div><span>${evidence.length} 条</span></div><div class="evidence-list">${evidence.map((item) => `<article class="evidence-item"><div class="evidence-dot"></div><div><div class="evidence-meta"><span>${escapeHtml(evidenceLabels[item.evidence_role] || item.evidence_role)}</span><time>${escapeHtml(item.published_at || item.checked_at || "")}</time></div><h3>${escapeHtml(item.title)}</h3><p>${escapeHtml(item.excerpt || "保留原文链接，未生成无依据的延伸判断。")}</p><small>${escapeHtml(item.source_name || "公开来源")}</small><a href="${escapeHtml(item.url)}" target="_blank" rel="noreferrer">打开原文 ↗</a></div></article>`).join("") || '<div class="block-empty">暂无证据</div>'}</div></section>`;
  renderSidebar(signal);
}).catch((error) => { document.querySelector("#signal-detail").innerHTML = `<div class="empty-state error-state">${escapeHtml(error.message)}</div>`; });
