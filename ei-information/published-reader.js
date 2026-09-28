(function (root, factory) {
  const api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.EIPublishedReader = api;
  if (root && root.document) root.document.addEventListener("DOMContentLoaded", () => api.boot(root));
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  const SECTIONS = Object.freeze({
    latest: { label: "综合动态", kind: "all" },
    articles: { label: "文章资讯", kind: "article" },
    papers: { label: "论文研究", kind: "paper" },
    policies: { label: "政策文件", kind: "policy" },
    wechat: { label: "关注公众号", kind: "wechat" },
    standards: { label: "标准跟踪", kind: "standard" },
    daily: { label: "日报", period: "daily" },
    weekly: { label: "周报", period: "weekly" },
    monthly: { label: "月报", period: "monthly" },
    discover: { label: "更多动态", kind: "discover" },
  });
  const KINDS = new Set(["article", "paper", "policy", "standard"]);
  const CHANNELS = new Set(["website", "wechat", "x"]);
  const STAGES = new Set(["proposal", "drafting", "consultation", "review", "approval", "published", "effective", "withdrawn"]);
  const STAGE_LABELS = Object.freeze({ proposal: "提案", drafting: "起草中", consultation: "征求意见", review: "审查中", approval: "报批", published: "已发布", effective: "已实施", withdrawn: "已废止" });
  const FILTERS = Object.freeze({ policies: ["region"], wechat: ["source"], standards: ["organization", "stage", "standard_type"] });
  const PAGE_SIZE = 60;

  function escapeHtml(value) {
    return String(value == null ? "" : value).replace(/[&<>"']/g, (char) => ({
      "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
    })[char]);
  }

  function safeSourceUrl(value) {
    if (typeof value !== "string") return null;
    try {
      const input = value.trim();
      const authority = input.match(/^[A-Za-z][A-Za-z0-9+.-]*:\/\/([^/?#]*)/);
      if (authority && authority[1].includes("@")) return null;
      const url = new URL(input);
      if (!["http:", "https:"].includes(url.protocol) || !url.hostname || url.username || url.password) return null;
      return url.href;
    } catch (_) { return null; }
  }

  function plainText(value) { return typeof value === "string" ? value : ""; }
  function validDate(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return "";
    const date = new Date(`${value}T00:00:00Z`);
    return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value ? value : "";
  }
  function projectCatalog(value) {
    if (!value || typeof value !== "object" || Array.isArray(value)) return null;
    const catalog = {
      kind: KINDS.has(value.kind) ? value.kind : "",
      source_name: plainText(value.source_name),
      source_channel: CHANNELS.has(value.source_channel) ? value.source_channel : "",
    };
    if (catalog.kind === "policy" && typeof value.region === "string") catalog.region = value.region;
    if (catalog.kind === "paper" && value.paper && typeof value.paper === "object" && !Array.isArray(value.paper)) {
      catalog.paper = { url: safeSourceUrl(value.paper.url) };
    }
    if (catalog.kind === "standard" && value.standard && typeof value.standard === "object" && !Array.isArray(value.standard)) {
      catalog.standard = {
        identifier: plainText(value.standard.identifier),
        organization: plainText(value.standard.organization),
        stage: STAGES.has(value.standard.stage) ? value.standard.stage : "",
        as_of: validDate(value.standard.as_of),
      };
    }
    return catalog;
  }
  function projectArticle(item, schemaVersion) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const article = {
      id: plainText(item.id), title: plainText(item.title), intro: plainText(item.intro),
      body: plainText(item.body), published_at: plainText(item.published_at),
      source: { id: plainText(item.source && item.source.id), url: safeSourceUrl(item.source && item.source.url) },
      catalog: schemaVersion === 3 ? projectCatalog(item.catalog) : null,
    };
    const reading = normalizeReading(item.reading);
    if (reading) article.reading = reading;
    return article;
  }
  function projectBriefing(item) {
    if (!item || typeof item !== "object" || !["daily", "weekly", "monthly"].includes(item.period)) return null;
    return {
      id: plainText(item.id), period: item.period, start_date: plainText(item.start_date),
      end_date: plainText(item.end_date), title: plainText(item.title), summary: plainText(item.summary),
      sections: Array.isArray(item.sections) ? item.sections.map((section) => ({
        heading: plainText(section && section.heading), body: plainText(section && section.body),
        article_ids: Array.isArray(section && section.article_ids) ? section.article_ids.filter((id) => typeof id === "string") : [],
      })) : [],
    };
  }
  function normalizeSnapshot(data) {
    if (!data || typeof data !== "object" || ![1, 2, 3].includes(data.schema_version)) throw new Error("snapshot");
    const articles = (Array.isArray(data.articles) ? data.articles : []).map((item) => projectArticle(item, data.schema_version)).filter((item) => item && item.id);
    const briefings = data.schema_version === 1 ? [] : (Array.isArray(data.briefings) ? data.briefings : []).map(projectBriefing).filter((item) => item && item.id);
    return { schema_version: data.schema_version, articles, briefings };
  }

  function normalizeReading(value) {
    if (!value || typeof value !== "object" || Array.isArray(value) || !["official", "abstract", "excerpt"].includes(value.mode)) return null;
    const reading = {
      mode: value.mode,
      points: Array.isArray(value.points) ? value.points.filter((point) => typeof point === "string").slice(0, 5).map((point) => point.slice(0, 60000)) : [],
      sections: Array.isArray(value.sections) ? value.sections.slice(0, 100).filter((section) => section && typeof section === "object" && !Array.isArray(section))
        .map((section) => ({ heading: typeof section.heading === "string" ? section.heading.slice(0, 60000) : "", text: typeof section.text === "string" ? section.text.slice(0, 60000) : "" })).filter((section) => section.text.trim()) : [],
    };
    if (value.mode === "abstract" && value.summary && typeof value.summary === "object" && !Array.isArray(value.summary) &&
        typeof value.summary.zh === "string" && value.summary.zh.trim() &&
        typeof value.summary.en === "string" && value.summary.en.trim()) {
      reading.summary = { zh: value.summary.zh.slice(0, 800), en: value.summary.en.slice(0, 3000) };
    }
    return reading.points.some((point) => point.trim()) || reading.sections.length || reading.summary ? reading : null;
  }

  function normalizeArchive(data) {
    if (!data || typeof data !== "object" || Array.isArray(data) || data.schema_version !== 1 || !Array.isArray(data.items)) return [];
    return data.items.map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item) || typeof item.id !== "string" || !item.id.startsWith("archive-") ||
          typeof item.title !== "string" || !item.title.trim() || typeof item.intro !== "string" ||
          !item.source || typeof item.source !== "object" || Array.isArray(item.source) || typeof item.source.id !== "string" || !item.source.id.trim()) return null;
      const sourceUrl = safeSourceUrl(item.source.url);
      const catalog = projectCatalog(item.catalog);
      const archive = item.archive;
      if (!sourceUrl || !catalog || !KINDS.has(item.catalog.kind) || !CHANNELS.has(item.catalog.source_channel) ||
          item.format !== "archive_record" || !archive || typeof archive !== "object" || Array.isArray(archive)) return null;
      const recordedAt = validDate(archive.recorded_at);
      const optionalText = (value) => typeof value === "string" ? value : "";
      const reading = normalizeReading(item.reading);
      const events = Array.isArray(archive.events) ? archive.events.map((event) => {
        if (!event || typeof event !== "object" || Array.isArray(event)) return null;
        const url = event.url == null || event.url === "" ? "" : safeSourceUrl(event.url);
        if (event.url && !url) return null;
        return { title: optionalText(event.title), type: optionalText(event.type), date: validDate(event.date), url, source_name: optionalText(event.source_name) };
      }).filter((event) => event && event.title) : [];
      const attachments = Array.isArray(archive.attachments) ? archive.attachments.map((attachment) => {
        if (!attachment || typeof attachment !== "object" || Array.isArray(attachment)) return null;
        const url = safeSourceUrl(attachment.url);
        return url && typeof attachment.title === "string" && attachment.title.trim() ? { title: attachment.title, url } : null;
      }).filter(Boolean) : [];
      return {
        id: item.id, title: item.title, intro: item.intro, body: "", published_at: validDate(item.published_at),
        source: { id: item.source.id, url: sourceUrl }, catalog, format: "archive_record",
        ...(reading ? { reading } : {}),
        archive: { recorded_at: recordedAt, standard_number: optionalText(archive.standard_number), plan_number: optionalText(archive.plan_number),
          level: optionalText(archive.level), status: optionalText(archive.status), organization: optionalText(archive.organization),
          department: optionalText(archive.department), counterpart_organization: optionalText(archive.counterpart_organization),
          executing_organization: optionalText(archive.executing_organization),
          implementation_date: validDate(archive.implementation_date), deadline: validDate(archive.deadline),
          drafting_units: Array.isArray(archive.drafting_units) ? archive.drafting_units.filter((unit) => typeof unit === "string" && unit.trim()) : [],
          lead_units: Array.isArray(archive.lead_units) ? archive.lead_units.filter((unit) => typeof unit === "string" && unit.trim()) : [],
          participating_units: Array.isArray(archive.participating_units) ? archive.participating_units.filter((unit) => typeof unit === "string" && unit.trim()) : [],
          related_units: Array.isArray(archive.related_units) ? archive.related_units.filter((unit) => typeof unit === "string" && unit.trim()) : [],
          metadata_sources: Array.isArray(archive.metadata_sources) ? archive.metadata_sources.map((source) => {
            if (!source || typeof source !== "object" || Array.isArray(source) || typeof source.title !== "string" || !source.title.trim()) return null;
            const url = safeSourceUrl(source.url);
            return url ? { title: source.title, url } : null;
          }).filter(Boolean) : [], events, attachments },
      };
    }).filter(Boolean);
  }

  function validTimestamp(value, now = Date.now()) {
    if (typeof value !== "string") return "";
    const match = value.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2}):(\d{2})(?:\.\d+)?(?:Z|[+-](\d{2}):(\d{2}))$/);
    if (!match) return "";
    const [, year, month, day, hour, minute, second, offsetHour = "0", offsetMinute = "0"] = match;
    const calendar = new Date(0);
    calendar.setUTCFullYear(Number(year), Number(month) - 1, Number(day));
    if (calendar.getUTCFullYear() !== Number(year) || calendar.getUTCMonth() !== Number(month) - 1 ||
        calendar.getUTCDate() !== Number(day) || Number(hour) > 23 || Number(minute) > 59 ||
        Number(second) > 59 || Number(offsetHour) > 23 || Number(offsetMinute) > 59) return "";
    const time = Date.parse(value);
    if (!Number.isFinite(time) || time > now) return "";
    return new Date(time).toISOString();
  }
  function normalizeNews(data, now = Date.now()) {
    if (!data || typeof data !== "object" || Array.isArray(data)) return { updated_at: null, items: [] };
    const updatedAt = data.updated_at === null ? null : validTimestamp(data.updated_at, now) || null;
    const items = (Array.isArray(data.items) ? data.items : []).map((item) => {
      if (!item || typeof item !== "object" || Array.isArray(item)) return null;
      const publishedAt = validTimestamp(item.published_at, now);
      const placement = item.placement;
      const sourceUrl = safeSourceUrl(item.source && item.source.url);
      const catalog = item.catalog;
      if (!publishedAt || !["main", "secondary"].includes(placement) || !sourceUrl ||
          !item.source || typeof item.source !== "object" || typeof item.source.id !== "string" ||
          !catalog || !["article", "paper"].includes(catalog.kind) || catalog.source_channel !== "website" ||
          item.format !== "source_excerpt" || typeof item.id !== "string" || !item.id.startsWith("news-") ||
          typeof item.title !== "string" || !item.title.trim() || typeof item.intro !== "string" || !item.intro.trim() ||
          !item.source.id.trim()) return null;
      const reading = normalizeReading(item.reading);
      return {
        id: item.id, title: item.title, intro: item.intro, body: "", published_at: publishedAt,
        source: { id: plainText(item.source.id), url: sourceUrl },
        catalog: { kind: catalog.kind, source_name: plainText(catalog.source_name), source_channel: "website",
          ...(catalog.kind === "paper" && catalog.paper && safeSourceUrl(catalog.paper.url) ? { paper: { url: safeSourceUrl(catalog.paper.url) } } : {}) },
        placement, format: "source_excerpt", ...(reading ? { reading } : {}),
      };
    }).filter(Boolean);
    return { updated_at: updatedAt, items };
  }

  function dateKey(value) {
    if (!value) return "";
    const match = String(value).match(/^\d{4}-\d{2}-\d{2}/);
    return match ? match[0] : "";
  }
  function periodForSection(section) { return SECTIONS[section] ? SECTIONS[section].period : null; }
  function articleKind(article) { return article.catalog ? article.catalog.kind : "article"; }
  function standardRecordType(item) {
    if (item && item.catalog && item.catalog.kind === "standard") {
      return item.format === "archive_record" && item.id.startsWith("archive-standard-") ? "project" : "announcement";
    }
    return "other";
  }
  function isBriefing(item) { return Boolean(item && Array.isArray(item.sections) && item.period); }
  function entryDate(item) { return isBriefing(item) ? item.end_date : dateKey(item.published_at); }
  function sortEntries(entries) {
    const sortDate = (item) => item.catalog && item.catalog.kind === "standard" && item.archive && item.archive.recorded_at
      ? (item.published_at || item.archive.recorded_at) : item.published_at || entryDate(item);
    return entries.slice().sort((a, b) => (Date.parse(sortDate(b)) || 0) - (Date.parse(sortDate(a)) || 0) || a.id.localeCompare(b.id));
  }
  function arxivWorkId(value) {
    const safeUrl = safeSourceUrl(value);
    if (!safeUrl) return null;
    const url = new URL(safeUrl);
    if (url.hostname.replace(/^www\./, "") !== "arxiv.org") return null;
    const match = url.pathname.match(/^\/(?:abs|html|pdf)\/(\d{4}\.\d{4,5})(?:v\d+)?(?:\.pdf)?\/?$/i);
    return match ? match[1] : null;
  }
  function duplicateKey(item) {
    const workId = arxivWorkId(item.source && item.source.url);
    return workId ? `arxiv:${workId}` : `${item.source && item.source.id || ""}\n${safeSourceUrl(item.source && item.source.url) || ""}`;
  }
  function mergedNews(snapshot, placement = "main") {
    const edited = new Set((snapshot.articles || []).map(duplicateKey));
    return (snapshot.news ? snapshot.news.items : []).filter((item) => (!placement || item.placement === placement) && !edited.has(duplicateKey(item)));
  }
  function mergedArchive(snapshot) {
    const articles = snapshot.articles || [];
    const archiveItems = snapshot.archive ? snapshot.archive.items : [];
    const higherPriorityItems = [...articles, ...((snapshot.news && snapshot.news.items) || [])];
    const higherPriority = new Set(higherPriorityItems.map(duplicateKey));
    const higherPriorityUrls = new Set(higherPriorityItems.map((item) => safeSourceUrl(item.source && item.source.url)).filter(Boolean));
    return archiveItems.filter((item) => {
      if (standardRecordType(item) === "project") return true;
      const url = safeSourceUrl(item.source && item.source.url);
      return !higherPriority.has(duplicateKey(item)) && !higherPriorityUrls.has(url);
    });
  }
  function isOfficialWechat(value) {
    const safeUrl = safeSourceUrl(value);
    return Boolean(safeUrl && new URL(safeUrl).hostname.toLowerCase() === "mp.weixin.qq.com");
  }
  function interleaveByKind(entries) {
    const groups = new Map();
    const topical = /机器人|具身|人形|人工智能|robot|humanoid|embodied|physical\s*ai/i;
    const kindsInOrder = ["article", "standard", "policy", "paper"];
    for (const item of sortEntries(entries)) {
      const kind = articleKind(item);
      if (!groups.has(kind)) groups.set(kind, []);
      groups.get(kind).push(item);
    }
    for (const group of groups.values()) group.sort((a, b) => Number(topical.test(`${b.title} ${b.intro}`)) - Number(topical.test(`${a.title} ${a.intro}`)));
    const kindOrder = [...kindsInOrder, ...[...groups.keys()].filter((kind) => !kindsInOrder.includes(kind))];
    const result = [];
    for (const relevant of [true, false]) {
      while (kindOrder.some((kind) => (groups.get(kind) || []).some((item) => topical.test(`${item.title} ${item.intro}`) === relevant))) {
        for (const kind of kindOrder) {
          const group = groups.get(kind) || [];
          const index = group.findIndex((item) => topical.test(`${item.title} ${item.intro}`) === relevant);
          if (index >= 0) result.push(...group.splice(index, 1));
        }
      }
    }
    return result;
  }
  function collection(snapshot, section) {
    if (!SECTIONS[section]) return [];
    if (periodForSection(section)) return sortEntries(snapshot.briefings.filter((item) => item.period === periodForSection(section)));
    if (section === "discover") return sortEntries(mergedNews(snapshot, "secondary"));
    if (section === "latest") return interleaveByKind([...snapshot.articles, ...mergedNews(snapshot), ...mergedArchive(snapshot)]);
    if (section === "wechat") return sortEntries([
      ...snapshot.articles.filter((item) => item.catalog && item.catalog.source_channel === "wechat"),
      ...mergedArchive(snapshot).filter((item) => item.catalog.source_channel === "wechat" && isOfficialWechat(item.source.url)),
    ]);
    return sortEntries([...snapshot.articles.filter((item) => articleKind(item) === SECTIONS[section].kind),
      ...mergedNews(snapshot).filter((item) => item.catalog.kind === SECTIONS[section].kind),
      ...mergedArchive(snapshot).filter((item) => item.catalog.kind === SECTIONS[section].kind)]);
  }
  function optionsFor(snapshot, section) {
    const entries = collection(snapshot, section);
    if (section === "policies") return { region: uniqueOptions(entries.map((item) => [item.catalog && item.catalog.region, item.catalog && item.catalog.region])) };
    if (section === "wechat") return { source: uniqueOptions(entries.map((item) => [item.source.id, item.catalog && (item.catalog.source_name || item.source.id)])) };
    if (section === "standards") return {
      organization: uniqueOptions(entries.map((item) => [item.catalog && item.catalog.standard && item.catalog.standard.organization, item.catalog && item.catalog.standard && item.catalog.standard.organization])),
      stage: uniqueOptions(entries.map((item) => [item.catalog && item.catalog.standard && item.catalog.standard.stage, item.catalog && item.catalog.standard && STAGE_LABELS[item.catalog.standard.stage]])),
      standard_type: [{ value: "project", label: "标准项目" }, { value: "announcement", label: "标准公告" }],
    };
    return {};
  }
  function uniqueOptions(pairs) {
    const values = new Map();
    for (const [value, label] of pairs) if (typeof value === "string" && value && typeof label === "string" && label) values.set(value, label);
    return [...values].sort((a, b) => a[1].localeCompare(b[1], "zh-CN")).map(([value, label]) => ({ value, label }));
  }
  function filterResult(snapshot, section, filters = {}) {
    const options = optionsFor(snapshot, section);
    const applicable = FILTERS[section] || [];
    const invalid = applicable.filter((key) => Object.hasOwn(filters, key) && !options[key].some((option) => option.value === filters[key]));
    const entries = invalid.length ? [] : collection(snapshot, section).filter((item) => {
      if (section === "policies" && filters.region && item.catalog.region !== filters.region) return false;
      if (section === "wechat" && filters.source && item.source.id !== filters.source) return false;
      if (section === "standards") {
        const standard = item.catalog && item.catalog.standard;
        if (filters.standard_type && standardRecordType(item) !== filters.standard_type) return false;
        if (filters.organization && (!standard || standard.organization !== filters.organization)) return false;
        if (filters.stage && (!standard || standard.stage !== filters.stage)) return false;
      }
      return true;
    });
    return { entries, options, invalid };
  }
  function searchText(item) {
    if (isBriefing(item)) return [item.title, item.summary, ...item.sections.flatMap((part) => [part.heading, part.body])].filter(Boolean).join(" ");
    const catalog = item.catalog;
    const standard = catalog && catalog.standard;
    return [item.title, item.intro, item.body, item.source.id, catalog && catalog.kind, catalog && catalog.source_name,
      item.reading && [...item.reading.points, ...item.reading.sections.flatMap((section) => [section.heading, section.text])].join(" "),
      item.reading && item.reading.summary && [item.reading.summary.zh, item.reading.summary.en].join(" "),
      catalog && catalog.source_channel, catalog && catalog.region, catalog && catalog.paper && catalog.paper.url,
      item.archive && Object.values(item.archive).filter((value) => typeof value === "string").join(" "),
      item.archive && item.archive.events.flatMap((event) => [event.title, event.type, event.source_name]).join(" "),
      item.archive && item.archive.drafting_units.join(" "),
      item.archive && [item.archive.counterpart_organization, item.archive.executing_organization, ...item.archive.lead_units, ...item.archive.participating_units, ...item.archive.related_units, ...item.archive.metadata_sources.flatMap((source) => [source.title, source.url])].join(" "),
      standard && standard.identifier, standard && standard.organization, standard && standard.stage,
      standard && STAGE_LABELS[standard.stage], standard && standard.as_of].filter(Boolean).join(" ");
  }
  function visibleEntries(snapshot, section, query, filters = {}) {
    const q = String(query || "").trim().toLocaleLowerCase();
    return filterResult(snapshot, section, filters).entries.filter((item) => !q || searchText(item).toLocaleLowerCase().includes(q));
  }
  function resolveSelection(snapshot, section, id, query, filters = {}) {
    const entries = visibleEntries(snapshot, section, query, filters);
    if (id) return entries.find((item) => item.id === id) || null;
    return entries[0] || null;
  }
  function paragraphs(text) {
    return plainText(text).split(/\n\s*\n/).map((part) => part.trim()).filter(Boolean)
      .map((part) => `<p class="published-paragraph">${escapeHtml(part).replace(/\n/g, "<br>")}</p>`).join("");
  }
  function dateLabel(value) { return escapeHtml(dateKey(value)); }
  function timestampLabel(value) {
    const time = Date.parse(value);
    return Number.isFinite(time) ? escapeHtml(new Intl.DateTimeFormat(undefined, { year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" }).format(new Date(time))) : dateLabel(value);
  }
  function articleSection(article) {
    if (articleKind(article) === "paper") return "papers";
    if (articleKind(article) === "policy") return "policies";
    if (articleKind(article) === "standard") return "standards";
    return "articles";
  }
  function internalArticleHref(article) { return `?${new URLSearchParams({ section: articleSection(article), id: article.id })}`; }
  function sourceLink(article, label, url = article.source.url) {
    const safeUrl = safeSourceUrl(url);
    if (!safeUrl) return "";
    return `<a class="text-link" href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label)}</a>`;
  }
  function renderArticle(article) {
    const catalog = article.catalog;
    const kind = articleKind(article);
    const archive = article.archive;
    const archiveStandard = Boolean(archive && standardRecordType(article) === "project");
    const detail = [];
    if (kind === "policy" && catalog && catalog.region) detail.push(`地区：${escapeHtml(catalog.region)}`);
    if (catalog && catalog.source_name && !archiveStandard) detail.push(`来源：${escapeHtml(catalog.source_name)}`);
    if (kind === "standard" && catalog && catalog.standard && !archiveStandard) {
      const standard = catalog.standard;
      if (standard.organization) detail.push(`组织：${escapeHtml(standard.organization)}`);
      if (standard.identifier) detail.push(`编号：${escapeHtml(standard.identifier)}`);
      if (standard.stage && standard.as_of) detail.push(`进展：${escapeHtml(STAGE_LABELS[standard.stage])} · 截至 ${dateLabel(standard.as_of)}`);
    }
    if (archive) {
      if (!archiveStandard) {
        if (archive.recorded_at) detail.push(`收录日期：${dateLabel(archive.recorded_at)}`);
        if (archive.organization) detail.push(`归口单位：${escapeHtml(archive.organization)}`);
        if (archive.department) detail.push(`主管部门：${escapeHtml(archive.department)}`);
      }
    }
    const paperUrl = kind === "paper" && catalog && catalog.paper ? catalog.paper.url : null;
    const paperLink = paperUrl ? sourceLink(article, "论文原文", paperUrl) : "";
    const sourceUrl = safeSourceUrl(article.source.url);
    const sourceLabel = catalog && catalog.source_channel === "wechat" ? "公众号原文" : "来源原文";
    const sourceLinkMarkup = kind === "paper"
      ? [paperLink, sourceUrl && sourceUrl !== safeSourceUrl(paperUrl) ? sourceLink(article, sourceLabel, sourceUrl) : ""].filter(Boolean).join(" · ")
      : sourceLink(article, "查看原文", sourceUrl);
    const sourceHost = article.source.url ? new URL(article.source.url).hostname.replace(/^www\./, "") : "";
    const isNews = article.format === "source_excerpt";
    const meta = [...(article.published_at ? [`${isNews ? "原文发布时间" : "发布日期"}：${isNews ? timestampLabel(article.published_at) : dateLabel(article.published_at)}`] : []), ...detail];
    if (!meta.length && sourceHost) meta.push(`来源：${escapeHtml(sourceHost)}`);
    const standardFields = archiveStandard ? [
      ["标准编号", archive.standard_number], ["计划号", archive.plan_number], ["层级", archive.level], ["档案阶段", archive.status],
      ["归口单位", archive.organization], ["对口单位", archive.counterpart_organization], ["执行单位", archive.executing_organization], ["主管部门", archive.department], ["收录日期", archive.recorded_at],
      ["实施日期", archive.implementation_date], ["截止日期", archive.deadline],
    ].filter(([, value]) => value).map(([label, value]) => `<div><dt>${label}</dt><dd>${escapeHtml(label.includes("日期") ? dateLabel(value) : value)}</dd></div>`).join("") : "";
    const standardDl = standardFields ? `<dl class="published-standard-details">${standardFields}</dl>` : "";
    const draftingText = archiveStandard && archive.drafting_units.length ? `<p class="published-drafting-units"><strong>起草单位：</strong>${archive.drafting_units.map(escapeHtml).join("、")}</p>` : "";
    const draftingUnits = archiveStandard && archive.drafting_units.length > 8 ? `<details class="published-unit-roster"><summary>完整起草单位（${archive.drafting_units.length} 家）</summary>${draftingText}</details>` : draftingText;
    const leadUnits = archiveStandard && archive.lead_units.length ? `<p class="published-drafting-units"><strong>牵头单位：</strong>${archive.lead_units.map(escapeHtml).join("、")}</p>` : "";
    const participatingUnits = archiveStandard && archive.participating_units.length ? `<p class="published-drafting-units"><strong>参与单位：</strong>${archive.participating_units.map(escapeHtml).join("、")}</p>` : "";
    const relatedUnits = archiveStandard ? archive.related_units.filter((unit) => !archive.drafting_units.includes(unit)) : [];
    const relatedUnitsMarkup = relatedUnits.length ? `<p class="published-drafting-units"><strong>相关单位：</strong>${relatedUnits.map(escapeHtml).join("、")}</p>` : "";
    const metadataSources = archiveStandard && archive.metadata_sources.length ? `<section class="published-section published-metadata-sources"><h2>机构信息依据</h2><ul>${archive.metadata_sources.map((source) => `<li>${sourceLink(article, source.title, source.url)}</li>`).join("")}</ul></section>` : "";
    const archiveDetails = archive && archive.events.length ? `<section class="published-section"><h2>事件记录</h2><ol class="published-events">${archive.events.map((event) => `<li>${event.date ? `<time>${dateLabel(event.date)}</time> · ` : ""}${event.url ? sourceLink(article, event.title, event.url) : escapeHtml(event.title)}${event.type ? ` · ${escapeHtml(event.type)}` : ""}${event.source_name ? ` · ${escapeHtml(event.source_name)}` : ""}</li>`).join("")}</ol></section>` : "";
    const attachments = archive && archive.attachments.length ? `<section class="published-section"><h2>附件与补充原文</h2><ul class="published-events">${archive.attachments.map((attachment) => `<li>${sourceLink(article, attachment.title, attachment.url)}</li>`).join("")}</ul></section>` : "";
    const archiveNotice = archive && kind === "standard" ? `<p class="published-archive-note">阶段与事件按原记录展示，最新状态以来源原文为准。</p>` : "";
    const reading = article.reading || (archive && archive.reading);
    const readingLabel = reading && (reading.mode === "official" ? reading.points.length ? "内容要点" : "文件内容" : reading.mode === "abstract" ? "研究摘要" : "内容摘读");
    const originalAbstract = reading && reading.mode === "abstract" && reading.summary
      ? [...reading.points.map((point) => `<p class="published-paragraph">${escapeHtml(point)}</p>`), ...reading.sections.map((section) => `${section.heading ? `<h3>${escapeHtml(section.heading)}</h3>` : ""}${paragraphs(section.text)}`)].join("") : "";
    const readingMarkup = reading ? `<section class="published-reading" aria-label="${readingLabel}">
      <h2>${readingLabel}${reading.mode === "official" ? '<small>（原文节选）</small>' : ""}</h2>
      ${reading.summary ? `<section class="published-bilingual-summary"><div lang="zh-CN"><h3>论文中文总结</h3>${paragraphs(reading.summary.zh)}</div><div lang="en"><h3>English summary</h3>${paragraphs(reading.summary.en)}</div><p class="published-summary-source">AI 辅助整理，基于原文摘要</p></section>` : ""}
      ${originalAbstract ? `<details class="published-original-abstract"><summary>展开原始摘要</summary>${originalAbstract}</details>` : ""}
      ${reading.points.length && !reading.summary ? `<ul class="published-reading-points">${reading.points.map((point) => `<li>${escapeHtml(point)}</li>`).join("")}</ul>` : ""}
      ${reading.mode === "official" && reading.sections.length ? `<details class="published-document"${reading.points.length ? "" : " open"}><summary>展开文件正文</summary>
        <p class="published-archive-note">按收录版本整理，适用状态及附件以发布机构原文为准。</p>
        ${reading.sections.map((section) => `<section class="published-reading-section">${section.heading ? `<h3>${escapeHtml(section.heading)}</h3>` : ""}${paragraphs(section.text)}</section>`).join("")}</details>` : ""}
      ${reading.mode !== "official" && !originalAbstract ? reading.sections.map((section) => `<section class="published-section published-reading-section">${section.heading ? `<h2>${escapeHtml(section.heading)}</h2>` : ""}${paragraphs(section.text)}</section>`).join("") : ""}
      </section>` : "";
    const introLabel = archiveStandard ? "内容范围：" : archive && article.intro ? "原文摘录：" : kind === "paper" ? "论文简介：" : "";
    return `<article class="article${isNews ? " published-news" : ""}"><h1 class="article-title">${escapeHtml(article.title)}</h1>
      ${sourceLinkMarkup ? `<p class="published-original">${sourceLinkMarkup}</p>` : ""}
      ${archiveStandard ? standardDl : meta.length ? `<p class="published-meta">${meta.join(" · ")}</p>` : ""}
      ${leadUnits}${participatingUnits}${draftingUnits}${relatedUnitsMarkup}${article.intro && !reading ? `<p class="published-intro">${isNews ? '<span class="published-news-label">原文摘要</span>' : introLabel}${escapeHtml(article.intro)}</p>` : ""}${readingMarkup}${isNews || archive ? "" : reading && article.body ? `<section class="published-section"><h2>研究导读</h2>${paragraphs(article.body)}</section>` : paragraphs(article.body)}${archiveNotice}${metadataSources}${archiveDetails}${attachments}</article>`;
  }
  function citationMarkup(section, articleMap) {
    const citations = [...new Set(section.article_ids)].map((id) => articleMap.get(id)).filter(Boolean);
    if (!citations.length) return "";
    return `<div class="published-citations" aria-label="相关已发布内容">${citations.map((article) => `<div class="published-citation">
      <a href="${escapeHtml(internalArticleHref(article))}">${escapeHtml(article.title)}</a>
      <small>${article.published_at ? `发布日期：${dateLabel(article.published_at)}` : ""}${sourceLink(article, " · 原文")}</small></div>`).join("")}</div>`;
  }
  function renderBriefing(briefing, snapshot) {
    const articleMap = new Map(snapshot.articles.map((article) => [article.id, article]));
    const citations = citationMarkup({ article_ids: [...new Set(briefing.sections.flatMap((section) => section.article_ids))] }, articleMap);
    return `<article class="article"><h1 class="article-title">${escapeHtml(briefing.title)}</h1>
      <p class="published-period">${dateLabel(briefing.start_date)} — ${dateLabel(briefing.end_date)}</p>
      ${briefing.summary ? `<p class="published-intro">${escapeHtml(briefing.summary)}</p>` : ""}
      ${briefing.sections.map((section) => `<section class="published-section"><h2>${escapeHtml(section.heading)}</h2>${paragraphs(section.body)}</section>`).join("")}
      ${citations ? `<section class="published-section"><h2>相关阅读与原文</h2>${citations}</section>` : ""}</article>`;
  }
  function listMarkup(entries, section, selectedId, state = {}) {
    if (!entries.length) return `<p class="published-empty">${section === "daily" || section === "weekly" || section === "monthly" ? "本期暂无已发布内容。" : "目前没有可阅读的内容。"}</p>`;
    return entries.map((item) => {
      const briefing = isBriefing(item);
      const targetSection = briefing ? item.period : section;
      const archiveDate = item.format === "archive_record" && item.archive.recorded_at &&
        (!item.published_at || standardRecordType(item) === "project") ? `收录日期：${dateKey(item.archive.recorded_at)}` : "";
      const publishedDate = item.published_at ? (item.format === "source_excerpt" ? timestampLabel(item.published_at) : `发布日期：${dateKey(item.published_at)}`) : "";
      const displayDate = standardRecordType(item) === "project" ? (archiveDate || publishedDate) : (publishedDate || archiveDate);
      const meta = briefing ? `${item.end_date} · ${SECTIONS[item.period].label}` : [displayDate, item.catalog && item.catalog.source_name].filter(Boolean).join(" · ");
      const id = item.id;
      const category = briefing ? "简报" : item.format === "archive_record" ? (articleKind(item) === "standard" ? standardRecordType(item) === "project" ? "标准项目" : "标准公告" : ({ paper: "论文档案", policy: "政策档案" }[articleKind(item)] || "资讯档案")) : item.format === "source_excerpt" ? (articleKind(item) === "paper" ? "论文快讯" : "资讯快讯") : ({ paper: "论文", policy: "政策", standard: "标准" }[articleKind(item)] || "文章");
      const params = new URLSearchParams({ section: targetSection, id });
      if (state.q) params.set("q", state.q);
      for (const key of FILTERS[targetSection] || []) if (state.filters && state.filters[key]) params.set(key, state.filters[key]);
      const summary = briefing ? "" : item.intro ? `${item.format === "archive_record" ? articleKind(item) === "standard" ? "内容范围：" : "原文摘录：" : ""}${item.intro}` : "";
      return `<a class="item-row${id === selectedId ? " selected" : ""}" href="${escapeHtml(`?${params}`)}" data-entry-id="${escapeHtml(id)}" data-entry-type="${briefing ? "briefing" : "article"}"${id === selectedId ? ' aria-current="true"' : ""}>
        <span class="item-meta">${escapeHtml(meta)}</span><span class="item-title">${escapeHtml(item.title)}</span><span class="item-kind">${category}</span>${summary ? `<span class="item-summary">${escapeHtml(summary)}</span>` : ""}</a>`;
    }).join("");
  }
  function readState(location) {
    const params = new URLSearchParams(location.search);
    const rawSection = params.get("section");
    const section = Object.hasOwn(SECTIONS, rawSection) ? rawSection : "latest";
    const filters = {};
    for (const key of ["region", "source", "organization", "stage", "standard_type"]) if (params.has(key)) filters[key] = params.get(key);
    return { section, id: params.get("id") || "", q: params.get("q") || "", filters, explicitId: params.has("id") };
  }
  function writeState(state, mode, win) {
    const params = new URLSearchParams({ section: state.section });
    if (state.id) params.set("id", state.id);
    if (state.q) params.set("q", state.q);
    for (const key of FILTERS[state.section] || []) if (state.filters && state.filters[key]) params.set(key, state.filters[key]);
    win.history[mode === "push" ? "pushState" : "replaceState"]({}, "", `${win.location.pathname}?${params}`);
  }
  function filterMarkup(section, options, filters) {
    const fields = FILTERS[section] || [];
    if (!fields.length) return "";
    const labels = { region: "地区", source: "公众号", organization: "组织", stage: "进展", standard_type: "标准类别" };
    const controls = fields.map((key) => {
      const active = Object.hasOwn(filters, key);
      const valid = active && options[key].some((option) => option.value === filters[key]);
      const invalidOption = active && !valid ? `<option value="${escapeHtml(filters[key])}" selected>当前值不可用：${escapeHtml(filters[key]) || "空值"}</option>` : "";
      const choices = options[key].map((option) => `<option value="${escapeHtml(option.value)}"${filters[key] === option.value ? " selected" : ""}>${escapeHtml(option.label)}</option>`).join("");
      return `<div class="published-filter"><label for="published-filter-${key}">${labels[key]}</label><span class="published-filter-control"><select id="published-filter-${key}" data-filter="${key}" aria-label="按${labels[key]}筛选">${invalidOption}<option value="">全部${labels[key]}</option>${choices}</select><button type="button" data-clear-filter="${key}"${active ? "" : " disabled"}>清除</button></span></div>`;
    }).join("");
    return `<div class="reader-tools"><div class="published-filter-row">${controls}</div></div>`;
  }

  function boot(win) {
    const shell = win.document.getElementById("reader-shell");
    const heading = win.document.getElementById("collection-title");
    const subtitle = win.document.getElementById("collection-subtitle");
    const tools = win.document.getElementById("collection-tools");
    const list = win.document.getElementById("collection-list");
    const reader = win.document.getElementById("reading-content");
    if (!shell || !heading || !subtitle || !tools || !list || !reader) return;

    let snapshot = { articles: [], briefings: [] };
    let news = { updated_at: null, items: [] };
    let archive = { items: [] };
    let loadError = false;
    let archiveError = false;
    let pageLimit = PAGE_SIZE;
    let mobileReading = Boolean(readState(win.location).id);
    let lastSelection = null;
    const panel = win.document.getElementById("reading-panel");
    const navigation = win.document.getElementById("primary-nav");
    function render() {
      const view = { ...snapshot, news, archive };
      const state = readState(win.location);
      const result = filterResult(view, state.section, state.filters);
      const q = state.q.trim().toLocaleLowerCase();
      const entries = result.entries.filter((item) => !q || searchText(item).toLocaleLowerCase().includes(q));
      const selected = state.id ? entries.find((item) => item.id === state.id) || null : entries[0] || null;
      heading.textContent = SECTIONS[state.section].label;
      const countUnit = periodForSection(state.section) ? "期简报" : state.section === "latest" ? "条内容" : "条内容";
      subtitle.textContent = state.q ? `搜索：${state.q} · ${entries.length} ${countUnit}` : `${entries.length} ${countUnit}${state.section === "latest" ? " · 优先机器人与具身智能，分类交替展示" : ""}`;
      if (!state.q && news.updated_at && ["latest", "articles", "papers", "discover"].includes(state.section)) {
        subtitle.textContent += ` · 收录更新 ${timestampLabel(news.updated_at)}`;
      }
      const counters = [
        ["standards", "标准"], ["policies", "政策"], ["articles", "资讯"], ["papers", "论文"],
      ].map(([section, label]) => {
        const entries = collection(view, section);
        const count = section === "standards"
          ? `<b>${entries.length}</b><small>项目 ${entries.filter((item) => standardRecordType(item) === "project").length} · 公告 ${entries.filter((item) => standardRecordType(item) === "announcement").length}</small>`
          : `<b>${entries.length}</b>`;
        return `<a class="published-category" href="?section=${section}" data-section="${section}"><span>${label}</span>${count}</a>`;
      }).join("");
      tools.innerHTML = `<nav class="published-categories" aria-label="分类数量">${counters}</nav><label class="search-field"><img class="ui-icon" src="reader-assets/icons/search.svg" alt="" aria-hidden="true"><input type="search" data-search aria-label="搜索${SECTIONS[state.section].label}" placeholder="搜索${SECTIONS[state.section].label}" value="${escapeHtml(state.q)}"></label>${filterMarkup(state.section, result.options, state.filters)}`;
      const shownEntries = entries.slice(0, pageLimit);
      const more = entries.length > shownEntries.length ? `<button class="published-load-more" type="button" data-load-more>加载更多（剩余 ${entries.length - shownEntries.length} 条）</button>` : "";
      list.innerHTML = loadError ? '<p class="published-empty published-error">暂时无法读取发布内容。</p>' : result.invalid.length ? '<p class="published-empty">筛选条件在当前栏目中没有匹配内容，请重新选择。</p>' : state.q && !entries.length ? '<p class="published-empty">没有找到匹配的内容。</p>' : `${listMarkup(shownEntries, state.section, selected && selected.id, state)}${more}`;
      list.setAttribute("aria-busy", "false");
      const archiveNotice = archiveError ? '<div class="published-empty" role="status">部分历史档案暂时无法读取。 <button type="button" data-retry-catalog>重试</button></div>' : "";
      reader.innerHTML = `${archiveNotice}${loadError ? '<p class="published-empty published-error">暂时无法读取发布内容。</p>' : selected ? (isBriefing(selected) ? renderBriefing(selected, view) : renderArticle(selected)) : `<p class="published-empty">${state.id ? "链接对应的内容当前不可用。" : state.q ? "没有找到匹配的内容。" : result.invalid.length ? "筛选条件在当前栏目中没有匹配内容。" : "目前没有可阅读的内容。"}</p>`}`;
      reader.setAttribute("aria-busy", "false");
      const retryCatalog = reader.querySelector("[data-retry-catalog]");
      if (retryCatalog) retryCatalog.addEventListener("click", () => { retryCatalog.disabled = true; fetchArchive(); });
      shell.classList.toggle("mobile-reading", mobileReading);
      if (panel && lastSelection !== (selected && selected.id)) panel.scrollTop = 0;
      lastSelection = selected && selected.id;
      win.document.querySelectorAll("[data-section]").forEach((link) => {
        if (link.dataset.section === state.section) link.setAttribute("aria-current", "page");
        else link.removeAttribute("aria-current");
      });
      const search = tools.querySelector("[data-search]");
      search.addEventListener("input", () => {
        const current = readState(win.location);
        const id = search.value === current.q ? current.id : "";
        mobileReading = false;
        pageLimit = PAGE_SIZE;
        writeState({ ...current, q: search.value, id }, "replace", win);
        render();
        const next = tools.querySelector("[data-search]");
        next.focus();
        next.setSelectionRange(next.value.length, next.value.length);
      });
      tools.querySelectorAll("[data-filter]").forEach((control) => control.addEventListener("change", () => {
        const current = readState(win.location);
        const filters = { ...current.filters };
        if (control.value) filters[control.dataset.filter] = control.value;
        else delete filters[control.dataset.filter];
        mobileReading = false;
        pageLimit = PAGE_SIZE;
        writeState({ ...current, id: "", filters }, "push", win);
        render();
      }));
      tools.querySelectorAll("[data-clear-filter]").forEach((button) => button.addEventListener("click", () => {
        const current = readState(win.location);
        const filters = { ...current.filters };
        delete filters[button.dataset.clearFilter];
        mobileReading = false;
        pageLimit = PAGE_SIZE;
        writeState({ ...current, id: "", filters }, "push", win);
        render();
      }));
      const loadMore = list.querySelector("[data-load-more]");
      if (loadMore) loadMore.addEventListener("click", () => { pageLimit += PAGE_SIZE; render(); });
      tools.querySelectorAll("[data-section]").forEach((link) => link.addEventListener("click", (event) => {
        event.preventDefault();
        pageLimit = PAGE_SIZE;
        writeState({ section: link.dataset.section, id: "", q: "", filters: {} }, "push", win);
        mobileReading = false;
        render();
      }));
      list.querySelectorAll("[data-entry-id]").forEach((link) => link.addEventListener("click", (event) => {
        event.preventDefault();
        writeState({ ...readState(win.location), id: link.dataset.entryId }, "push", win);
        mobileReading = true;
        render();
        if (panel) panel.focus({ preventScroll: true });
      }));
    }
    win.document.querySelectorAll("[data-section]").forEach((link) => link.addEventListener("click", (event) => {
      event.preventDefault();
      const section = link.dataset.section;
      pageLimit = PAGE_SIZE;
      writeState({ section, id: "", q: "", filters: {} }, "push", win);
      navigation.classList.remove("menu-open");
      mobileReading = false;
      const menu = win.document.querySelector("[data-menu]");
      if (menu) menu.setAttribute("aria-expanded", "false");
      render();
    }));
    const menu = win.document.querySelector("[data-menu]");
    if (menu) menu.addEventListener("click", () => {
      const open = navigation.classList.toggle("menu-open");
      menu.setAttribute("aria-expanded", String(open));
    });
    const back = win.document.querySelector("[data-back]");
    if (back) back.addEventListener("click", () => { mobileReading = false; shell.classList.remove("mobile-reading"); });
    win.addEventListener("popstate", () => { mobileReading = Boolean(readState(win.location).id); render(); });
    function fetchArchive() {
      win.fetch("catalog.json", { cache: "no-store" }).then((response) => {
        if (!response.ok) throw new Error("catalog");
        return response.json();
      }).then((data) => {
        if (!data || typeof data !== "object" || Array.isArray(data) || data.schema_version !== 1 || !Array.isArray(data.items)) throw new Error("catalog");
        archive = { items: normalizeArchive(data) };
        archiveError = false;
        render();
      }).catch(() => { archiveError = true; render(); });
    }
    render();
    win.fetch("data.json", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("snapshot");
      return response.json();
    }).then((data) => { snapshot = normalizeSnapshot(data); render(); })
      .catch(() => { loadError = true; render(); });
    win.fetch("news.json", { cache: "no-store" }).then((response) => {
      if (!response.ok) throw new Error("news");
      return response.json();
    }).then((data) => { news = normalizeNews(data); render(); }).catch(() => {});
    fetchArchive();
  }

  return { SECTIONS, STAGE_LABELS, FILTERS, PAGE_SIZE, escapeHtml, safeSourceUrl, normalizeReading, normalizeSnapshot, normalizeNews, normalizeArchive, projectCatalog, dateKey, articleKind, articleSection, standardRecordType, collection, optionsFor, filterResult, visibleEntries, resolveSelection, paragraphs, readState, writeState, renderArticle, renderBriefing, listMarkup, filterMarkup, internalArticleHref, boot };
});
