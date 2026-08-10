const state = {
  data: null,
  filters: {
    status: "全部",
    level: "全部",
    topic: "全部",
    query: "",
    unitName: "",
  },
  selectedId: null,
};

const FOCUS_PARTICIPANTS = [
  "北京人形机器人创新中心",
  "宇树科技",
  "优必选",
  "电子标准院",
  "信通院",
];

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

function daysUntil(value) {
  if (!value) return null;
  const end = new Date(`${value}T23:59:59+08:00`);
  return Math.ceil((end - new Date()) / 86400000);
}

function deadlineLabel(value) {
  const days = daysUntil(value);
  if (days === null) return "";
  if (days < 0) return `<span class="deadline">已截止</span>`;
  if (days <= 3) return `<span class="deadline urgent">${days === 0 ? "今天截止" : `${days}天内截止`}</span>`;
  if (days <= 7) return `<span class="deadline">${days}天内截止</span>`;
  return `<span class="deadline">截止 ${value.slice(5)}</span>`;
}

function standardLevel(project) {
  return project.standard_level === "工信部行标" ? "行标" : (project.standard_level || "国标");
}

function isTarget(project) { return project.topics?.length || project.confidence === "candidate"; }

function visibleProjects(source = state.data?.projects || []) {
  const target = source.filter(isTarget);
  const pool = target.length ? target : source;
  return pool.filter((project) => {
    const text = `${project.title} ${project.plan_number || ""} ${project.standard_number || ""} ${(project.topics || []).join(" ")}`.toLowerCase();
    const matchesQuery = !state.filters.query || text.includes(state.filters.query.toLowerCase());
    const matchesLevel = state.filters.level === "全部" || standardLevel(project) === state.filters.level;
    const matchesStatus = state.filters.status === "全部" || project.status === state.filters.status;
    const matchesTopic = state.filters.topic === "全部" || (project.topics || []).includes(state.filters.topic);
    return matchesQuery && matchesLevel && matchesStatus && matchesTopic;
  });
}

function renderStats() {
  const all = state.data?.projects || [];
  const target = all.filter(isTarget);
  const projects = target.length ? target : all;
  const due = projects.filter((project) => { const d = daysUntil(project.deadline); return d !== null && d >= 0 && d <= 7; }).length;
  const candidates = all.filter((project) => project.confidence === "candidate").length;
  $("#stat-projects").textContent = projects.length;
  $("#stat-new").textContent = projects.filter((project) => project.events?.length).length;
  $("#stat-due").textContent = due;
  $("#stat-candidates").textContent = candidates;
}

function projectButton(project) {
  return `<button class="project-card ${project.id === state.selectedId ? "selected" : ""}" data-project-id="${escapeHtml(project.id)}" type="button">
    <div class="card-main">
      <div class="card-meta"><span class="tag">${escapeHtml(standardLevel(project))}</span><span class="tag status">${escapeHtml(project.status || "候选")}</span></div>
      <h4 class="card-title">${escapeHtml(project.title)}</h4>
      <span class="card-number">${escapeHtml(project.plan_number || project.standard_number || "编号待确认")}</span>
      <div class="card-bottom"><span class="topic">${escapeHtml((project.topics || []).join(" · ") || "待分类")}</span><span>${escapeHtml(project.source || "官方来源")}</span>${deadlineLabel(project.deadline)}</div>
    </div><span aria-hidden="true">→</span>
  </button>`;
}

function bindProjectButtons() {
  $$(`[data-project-id]`).forEach((button) => button.addEventListener("click", () => {
    state.selectedId = button.dataset.projectId;
    renderList();
    renderDetail();
  }));
}

function renderList() {
  const list = $("#project-list");
  if (state.filters.unitName) {
    const unit = (state.data?.participants || []).find((item) => item.name === state.filters.unitName);
    const unitProjects = (state.data?.projects || []).filter((project) => (project.participants || []).some((item) => item.name === state.filters.unitName));
    if (!unitProjects.some((project) => project.id === state.selectedId)) state.selectedId = unitProjects[0]?.id || null;
    $("#list-title").textContent = `${unit?.display_name || state.filters.unitName}参与的标准`;
    list.innerHTML = unitProjects.length ? unitProjects.map(projectButton).join("") : '<div class="empty-state">暂未找到该单位参与的标准项目。</div>';
    bindProjectButtons();
    return;
  }
  $("#list-title").textContent = "标准项目";
  const projects = visibleProjects();
  list.innerHTML = projects.length ? projects.map(projectButton).join("") : '<div class="empty-state">没有符合当前筛选条件的标准项目。</div>';
  bindProjectButtons();
}

function projectIntroduction(project) {
  const description = (project.description || "").trim();
  if (description && !/公告|公示|通知/.test(description)) return description;
  return `围绕“${project.title}”建立统一的技术要求、测试方法或管理规范，具体范围以官方原文和附件为准。`;
}

function unitLink(participant, countMap) {
  const count = countMap.get(participant.name) || 0;
  return `<button type="button" class="participant-button" data-unit-name="${escapeHtml(participant.name)}"><span>${escapeHtml(participant.display_name || participant.name)}</span><b>${count} 项</b></button>`;
}

function bindParticipantButtons() {
  $$(`[data-unit-name]`).forEach((button) => button.addEventListener("click", () => {
    state.filters.unitName = button.dataset.unitName;
    location.hash = `unit=${encodeURIComponent(state.filters.unitName)}`;
    render();
  }));
  const toggle = $("#other-participants-toggle");
  const others = $("#other-participants");
  if (toggle && others) toggle.addEventListener("click", () => {
    const expanded = others.hidden;
    others.hidden = !expanded;
    toggle.textContent = expanded ? "收起其他单位" : `其他单位 ${others.dataset.count} 家`;
  });
  const back = $("#unit-back");
  if (back) back.addEventListener("click", () => { location.hash = ""; });
}

function renderParticipants(project) {
  const participants = project.participants || [];
  const countMap = new Map((state.data?.participants || []).map((item) => [item.name, item.count]));
  const focused = participants.filter((item) => FOCUS_PARTICIPANTS.includes(item.name));
  const others = participants.filter((item) => !FOCUS_PARTICIPANTS.includes(item.name));
  if (!participants.length) return `<section class="participants-section"><div class="participants-heading"><span>参与单位</span><b>待从附件表格提取</b></div></section>`;
  return `<section class="participants-section">
    <div class="participants-heading"><span>参与单位</span><b>${participants.length} 家主要起草单位</b></div>
    <div class="participant-list">${focused.map((item) => unitLink(item, countMap)).join("")}</div>
    ${others.length ? `<button type="button" class="other-toggle" id="other-participants-toggle">其他单位 ${others.length} 家</button><div class="participant-list other-participants" id="other-participants" data-count="${others.length}" hidden>${others.map((item) => unitLink(item, countMap)).join("")}</div>` : ""}
  </section>`;
}

function renderDetail() {
  const panel = $("#detail-panel");
  const project = (state.data?.projects || []).find((item) => item.id === state.selectedId);
  if (!project) { panel.innerHTML = '<div class="detail-empty"><div><b>◎</b>选择一个标准项目<br />查看它的完整时间线</div></div>'; return; }
  const events = [...(project.events || [])].sort((a, b) => new Date(a.date) - new Date(b.date));
  const committee = project.committee || "待从附件表格提取";
  const department = project.department || "待从附件表格提取";
  const detailNumber = project.plan_number || project.standard_number || "编号待确认";
  panel.innerHTML = `
    ${state.filters.unitName ? '<button type="button" class="back-button" id="unit-back">← 返回单位列表</button>' : ""}
    <p class="eyebrow detail-kicker">STANDARD TIMELINE</p>
    <h4>${escapeHtml(project.title)}</h4>
    <div class="detail-number">${escapeHtml(detailNumber)}</div>
    <p class="detail-source">${escapeHtml(standardLevel(project))} · ${escapeHtml(project.status || "候选")} ${project.deadline ? `· 截止 ${escapeHtml(project.deadline)}` : ""}</p>
    <section class="detail-intro"><p class="eyebrow detail-kicker">项目介绍</p><p>${escapeHtml(projectIntroduction(project))}</p></section>
    <div class="detail-facts"><div><span>主管司局</span><strong>${escapeHtml(department)}</strong></div><div><span>技术归口</span><strong>${escapeHtml(committee)}</strong></div><div><span>实施日期</span><strong>${escapeHtml(project.implementation_date || "待确认")}</strong></div><div><span>附件材料</span><strong>${project.attachments?.length || 0} 份</strong></div></div>
    <div class="timeline">${events.map((event) => `<div class="timeline-item"><span>${escapeHtml(event.date?.slice(0, 10) || "日期待确认")}</span><strong>${escapeHtml(event.type)}</strong>${event.title ? `<small>公告：${escapeHtml(event.title)}</small>` : ""}${event.source_url ? `<a href="${escapeHtml(event.source_url)}" target="_blank" rel="noreferrer">打开官方原文 ↗</a>` : ""}</div>`).join("")}</div>
    ${renderParticipants(project)}
    ${project.attachments?.length ? `<div class="detail-attachment">原文附件（${project.attachments.length}）${project.attachments.map((url) => `<a href="${escapeHtml(url)}" target="_blank" rel="noreferrer">${escapeHtml(url.split("/").pop() || "官方附件")} ↗</a>`).join("")}</div>` : ""}`;
  bindParticipantButtons();
}

function render() { renderStats(); renderList(); renderDetail(); }

function parseHash() {
  const match = location.hash.match(/^#unit=(.+)$/);
  state.filters.unitName = match ? decodeURIComponent(match[1]) : "";
}

async function loadData() {
  const response = await fetch("api/data");
  if (!response.ok) throw new Error("本地数据读取失败");
  state.data = await response.json();
  parseHash();
  const first = state.filters.unitName ? (state.data.projects || []).find((project) => (project.participants || []).some((item) => item.name === state.filters.unitName)) : visibleProjects()[0];
  state.selectedId = first?.id || null;
  render();
}

function escapeHtml(value) { return String(value ?? "").replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" }[char])); }

$("#search-input").addEventListener("input", (event) => { state.filters.query = event.target.value.trim(); renderList(); });
$$(`[data-level]`).forEach((button) => button.addEventListener("click", () => { state.filters.level = button.dataset.level; $$(`[data-level]`).forEach((item) => item.classList.toggle("active", item === button)); renderList(); }));
$$(`[data-status]`).forEach((button) => button.addEventListener("click", () => { state.filters.status = button.dataset.status; $$(`[data-status]`).forEach((item) => item.classList.toggle("active", item === button)); renderList(); }));
$$(`[data-topic]`).forEach((button) => button.addEventListener("click", () => { state.filters.topic = button.dataset.topic; $$(`[data-topic]`).forEach((item) => item.classList.toggle("active", item === button)); renderList(); }));
window.addEventListener("hashchange", () => { parseHash(); state.selectedId = state.filters.unitName ? (state.data?.projects || []).find((project) => (project.participants || []).some((item) => item.name === state.filters.unitName))?.id : null; render(); });
loadData().catch((error) => { $("#project-list").innerHTML = `<div class="empty-state error-state">${escapeHtml(error.message)}</div>`; });
