/* 李志简史 · 渲染引擎 */
(function () {
  "use strict";
  const D = window.LIZHI_DATA || {};
  const $ = (s) => document.querySelector(s);
  const esc = (s) => String(s == null ? "" : s).replace(/[&<>"]/g,
    c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

  /* ---------- HERO ---------- */
  const title = $("#hero-title");
  if (title) {
    "李志简史".split("").forEach((ch, i) => {
      const sp = document.createElement("span");
      sp.className = "char";
      sp.textContent = ch;
      sp.style.animationDelay = (i * 0.13) + "s";
      title.appendChild(sp);
    });
  }

  /* 跑马灯：所有曲目名 */
  const ticker = $("#ticker");
  if (ticker) {
    const names = [];
    (D.discography ? [].concat(D.discography.studio || [], D.discography.live || []) : [])
      .forEach(al => (al.tracks || []).forEach(t => t.title && names.push(t.title)));
    const uniq = [...new Set(names)];
    const pick = uniq.length ? uniq : ["天空之城", "热河", "梵高先生", "关于郑州的记忆"];
    const half = pick.map(n => `${esc(n)}<i>✕</i>`).join("");
    ticker.innerHTML = half + half;
  }

  /* 印章彩蛋 */
  const seal = $("#seal");
  if (seal) {
    seal.addEventListener("click", () => {
      seal.classList.remove("puff");
      void seal.offsetWidth;
      seal.classList.add("puff");
      showToast("点也没用，先把今天过完。");
    });
  }

  /* ---------- FACT STRIP ---------- */
  const facts = $("#facts");
  if (facts && D.meta) {
    const f = D.meta.facts || [];
    facts.innerHTML = f.map(x => `<div class="fact"><b>${esc(x.v)}</b><span>${esc(x.k)}</span></div>`).join("");
  }

  /* ---------- TIMELINE ---------- */
  const tl = $("#timeline");
  if (tl && D.timeline) {
    const eras = ["早年", "起步", "成名", "巅峰", "转折", "之后"];
    const groups = {};
    (D.timeline.events || []).forEach(e => {
      const k = eras.includes(e.era) ? e.era : "之后";
      (groups[k] = groups[k] || []).push(e);
    });
    let html = "";
    eras.forEach(era => {
      if (!groups[era]) return;
      html += `<div class="tl-era reveal">${era === "早年" ? "前传" : era} · ${era.toUpperCase()}</div>`;
      groups[era].forEach(e => {
        html += `<div class="tl-item reveal${e.importance >= 4 ? " hot" : ""}">
          <div class="tl-date">${esc(e.date)}</div>
          <h4>${esc(e.title)}</h4>
          <p>${esc(e.desc)}</p></div>`;
      });
    });
    tl.innerHTML = html;
  }

  /* ---------- 唱片封面生成 ---------- */
  function coverSVG(seedStr, idx) {
    let h = 0;
    for (let i = 0; i < seedStr.length; i++) h = (h * 31 + seedStr.charCodeAt(i)) >>> 0;
    const v = h % 4;
    const rot = (h >> 3) % 360;
    const red = "#c23b2a", paper = "#f2efe7", inkbg = "#141412", gray = "#57544c";
    let inner = "";
    if (v === 0) {
      for (let i = 0; i < 7; i++)
        inner += `<rect x="10" y="${14 + i * 11}" width="${55 + ((h >> i) % 30)}" height="${3 + (i % 3)}" fill="${i === 4 ? red : paper}" opacity="${0.85 - i * 0.09}"/>`;
    } else if (v === 1) {
      for (let i = 6; i >= 1; i--)
        inner += `<circle cx="50" cy="50" r="${i * 7}" fill="none" stroke="${i === 3 ? red : paper}" stroke-width="1.4" opacity="${0.25 + i * 0.1}"/>`;
      inner += `<circle cx="50" cy="50" r="2.6" fill="${red}"/>`;
    } else if (v === 2) {
      for (let i = -3; i < 9; i++)
        inner += `<line x1="${i * 14}" y1="-10" x2="${i * 14 + 34}" y2="110" stroke="${i % 3 === 1 ? red : paper}" stroke-width="${2 + (i % 2) * 2}" opacity="0.6"/>`;
    } else {
      inner += `<circle cx="68" cy="34" r="17" fill="${red}"/>
        <rect x="12" y="66" width="76" height="1.6" fill="${paper}"/>
        <rect x="12" y="74" width="52" height="1.6" fill="${gray}"/>
        <rect x="12" y="82" width="64" height="1.6" fill="${gray}"/>`;
    }
    return `<svg class="al-cover" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
      <rect width="100" height="100" fill="${inkbg}" transform="rotate(${rot * 0} 50 50)"/>${inner}</svg>`;
  }

  /* ---------- 播放引擎与曲库索引 ---------- */
  const PL = D.playlist || [];
  const norm = s => String(s || "").toLowerCase().replace(/\s+/g, "").replace(/[（）()【】\[\]/、，,。．·&＆＋+]/g, "");
  const byKey = {}, byName = {};
  PL.forEach(e => {
    byKey[e.album + "/" + e.name] = e;
    (byName[norm(e.name)] = byName[norm(e.name)] || []).push(e);
  });
  function findEntry(album, title) {
    let e = byKey[(album || "") + "/" + (title || "")];
    if (e) return e;
    const c = byName[norm(title)];
    return c && c.length === 1 ? c[0] : null;
  }
  const PKEYS = [];   /* 全量登记：pi -> entry */
  const PI_OF = new Map();
  PL.forEach((e, i) => { PKEYS.push(e); PI_OF.set(e, i); });

  const Player = (() => {
    const el = $("#player");
    if (!el) return { toggleQueue() { }, playEntry() { } };
    const audio = new Audio();
    const ui = {
      cover: $("#pl-cover"), name: $("#pl-name"), album: $("#pl-album"),
      toggle: $("#pl-toggle"), bar: $("#pl-bar"), seek: $("#pl-seek"),
      time: $("#pl-time"), mode: $("#pl-mode")
    };
    let queue = [], qi = -1;
    let srcLadder = [], si = 0, gotSignal = false, watchdog = null;
    const fmt = s => { s = Math.max(0, s | 0); return Math.floor(s / 60) + ":" + String(s % 60).padStart(2, "0"); };
    function markRow() {
      document.querySelectorAll("#albums tr.playing").forEach(tr => tr.classList.remove("playing"));
      const cur = queue[qi];
      if (!cur) return;
      document.querySelectorAll("#albums tr[data-pi]").forEach(tr => {
        if (+tr.dataset.pi === cur.pi) tr.classList.add("playing");
      });
    }
    /* 源梯子：主 CDN -> 备用节点 -> 本地备份（冷缓存挂起 / 断网 / 被墙都能接住） */
    function buildLadder(e) {
      const list = [e.url];
      const alt = e.url.replace("testingcf.jsdelivr.net", "fastly.jsdelivr.net");
      if (alt !== e.url) list.push(alt);
      if (e.local) list.push("../" + e.local);
      return list;
    }
    function applySrc() {
      gotSignal = false;
      audio.src = srcLadder[si];
      ui.mode.textContent = si === 0 ? "CDN" : (srcLadder[si].indexOf("http") === 0 ? "CDN·备线" : "本地备份");
      clearTimeout(watchdog);
      watchdog = setTimeout(() => { if (!gotSignal) nextSource(); }, 6000);
      const p = audio.play();
      if (p && p.catch) p.catch(() => {});
      ui.toggle.textContent = "⏸";
    }
    function nextSource() {
      if (gotSignal) return;
      if (si < srcLadder.length - 1) { si++; applySrc(); }
      else {
        clearTimeout(watchdog);
        const cur = queue[qi];
        showToast("《" + (cur ? cur.entry.name : "") + "》暂时播不了");
        ui.toggle.textContent = "▶";
      }
    }
    function load() {
      const item = queue[qi];
      if (!item) return;
      const e = item.entry;
      srcLadder = buildLadder(e); si = 0;
      ui.cover.style.display = e.cover ? "" : "none";
      ui.cover.src = e.cover || "";
      ui.name.textContent = e.name;
      ui.album.textContent = e.album;
      el.hidden = false;
      document.body.classList.add("has-player");
      applySrc();
      markRow();
    }
    function toggleQueue(pis, startIdx) {
      const items = pis.map(pi => ({ pi, entry: PKEYS[pi] }));
      const clicked = items[startIdx];
      if (qi >= 0 && queue[qi] && clicked && queue[qi].pi === clicked.pi) {
        if (audio.paused) { audio.play(); ui.toggle.textContent = "⏸"; }
        else { audio.pause(); ui.toggle.textContent = "▶"; }
        return;
      }
      queue = items; qi = startIdx; load();
    }
    function playEntry(e) {
      queue = PL.map(x => ({ pi: PKEYS.indexOf(x), entry: x }));
      qi = Math.max(0, PKEYS.indexOf(e));
      load();
    }
    function step(d) {
      if (!queue.length) return;
      qi = (qi + d + queue.length) % queue.length;
      load();
    }
    ["playing", "loadedmetadata", "canplay"].forEach(ev =>
      audio.addEventListener(ev, () => { gotSignal = true; clearTimeout(watchdog); }));
    audio.addEventListener("ended", () => step(1));
    audio.addEventListener("error", () => { if (!gotSignal) nextSource(); });
    audio.addEventListener("timeupdate", () => {
      if (audio.duration) ui.bar.style.width = (audio.currentTime / audio.duration * 100) + "%";
      ui.time.textContent = fmt(audio.currentTime) + " / " + (audio.duration ? fmt(audio.duration) : "--:--");
    });
    ui.seek.addEventListener("click", ev => {
      if (!audio.duration) return;
      const r = ui.seek.getBoundingClientRect();
      audio.currentTime = (ev.clientX - r.left) / r.width * audio.duration;
    });
    ui.toggle.addEventListener("click", () => {
      if (audio.paused) { audio.play(); ui.toggle.textContent = "⏸"; }
      else { audio.pause(); ui.toggle.textContent = "▶"; }
    });
    $("#pl-prev").addEventListener("click", () => step(-1));
    $("#pl-next").addEventListener("click", () => step(1));
    $("#pl-close").addEventListener("click", () => {
      audio.pause(); el.hidden = true; document.body.classList.remove("has-player");
      clearTimeout(watchdog); queue = []; qi = -1;
      document.querySelectorAll("#albums tr.playing").forEach(tr => tr.classList.remove("playing"));
    });
    return { toggleQueue, playEntry };
  })();

  /* ---------- 专辑列表 ---------- */
  const albBox = $("#albums");
  if (albBox && D.discography) {
    const secs = [
      { key: "studio", label: "录音室专辑" },
      { key: "live", label: "现场专辑" },
      { key: "ep_singles", label: "EP / 单曲 / 合辑" }
    ];
    let html = "";
    secs.forEach(sec => {
      const arr = D.discography[sec.key] || [];
      arr.filter(a => !a.hide).forEach((a, i) => {
        const tracks = a.tracks || [];
        const dur = t => t.duration_sec ? Math.floor(t.duration_sec / 60) + ":" + String(t.duration_sec % 60).padStart(2, "0") : "";
        const rows = tracks.map(t => {
          const e = findEntry(a.title, t.title);
          if (!e) return `<tr><td>${esc(t.no ?? "")}</td><td>${esc(t.title)}${t.note ? ` <small style="color:var(--gray-dark)">(${esc(t.note)})</small>` : ""}</td><td>${dur(t)}</td></tr>`;
          const pi = PI_OF.get(e);
          return `<tr data-pi="${pi}" title="点击播放"><td><span class="tr-play">▶</span>${esc(t.no ?? "")}</td><td>${esc(t.title)}${t.note ? ` <small style="color:var(--gray-dark)">(${esc(t.note)})</small>` : ""}</td><td>${dur(t)}</td></tr>`;
        }).join("");
        const chips = (a.links || []).map(l =>
          `<a class="chip ${l.hot ? "red" : ""}" target="_blank" rel="noopener" href="${esc(l.url)}">${esc(l.label)} ↗</a>`).join("");
        html += `
        <div class="album reveal" data-album>
          <div class="album-row">
            <span class="al-year">${esc(a.year || "")}</span>
            ${coverSVG((a.title || "") + i, i)}
            <div>
              <div class="al-name">《${esc(a.title)}》</div>
              <div class="al-meta">${esc(a.label || sec.label)} · ${tracks.length ? tracks.length + " TRACKS" : (a.note ? esc(a.note).slice(0, 24) : sec.label)}</div>
            </div>
            <span class="al-toggle">+</span>
          </div>
          <div class="album-detail"><div class="album-detail-inner">
            <table class="track-table">${rows || `<tr><td></td><td>${esc(a.note || "")}</td><td></td></tr>`}</table>
            <div class="album-note">
              <span class="tagline">${esc(a.tagline || "")}</span>
              ${esc(a.desc || "")}
              <div class="album-links">${chips}
                <a class="chip" target="_blank" rel="noopener" href="https://lizhi.dengdengju.com/">在线听 ↗</a>
              </div>
            </div>
          </div></div>
        </div>`;
      });
    });
    albBox.innerHTML = html;
    albBox.querySelectorAll("[data-album]").forEach(el => {
      el.querySelector(".album-row").addEventListener("click", () => el.classList.toggle("open"));
    });
    albBox.addEventListener("click", ev => {
      const tr = ev.target.closest("tr[data-pi]");
      if (!tr) return;
      const albumEl = tr.closest("[data-album]");
      const pis = [...albumEl.querySelectorAll("tr[data-pi]")].map(r => +r.dataset.pi);
      Player.toggleQueue(pis, pis.indexOf(+tr.dataset.pi));
    });
  }

  /* ---------- 地理 ---------- */
  const geo = $("#geo");
  if (geo && D.places) {
    geo.innerHTML = D.places.map(p => `
      <div class="roadsign-wrap reveal">
        <div class="roadsign">
          <div class="rs-py">${esc(p.py || "")} · NANJING</div>
          <div class="rs-name">${esc(p.name)}</div>
          <span class="rs-song">♪ ${esc(p.song)}</span>
          <div class="rs-note">${esc(p.note || "")}</div>
        </div>
      </div>`).join("");
  }

  /* ---------- 外链 ---------- */
  const lk = $("#links");
  if (lk && D.links) {
    lk.innerHTML = D.links.map(cat => `
      <div class="link-cat reveal">
        <h3>${esc(cat.name)}</h3>
        ${cat.links.map(l => `
          <a class="link-item" target="_blank" rel="noopener" href="${esc(l.url)}">
            <span class="arr">↗</span><b>${esc(l.title)}</b><span>${esc(l.desc || "")}</span>
          </a>`).join("")}
      </div>`).join("");
  }

  /* ---------- 语录 ---------- */
  const q = $("#quotes");
  if (q && D.quotes) {
    q.innerHTML = D.quotes.map(x => `
      <blockquote class="quote reveal"><p>${esc(x.text)}</p><cite>—— ${esc(x.source)}</cite></blockquote>`).join("");
  }

  /* ---------- 随机一首（现在真的播） ---------- */
  const rb = $("#rb-btn");
  if (rb) {
    rb.addEventListener("click", () => {
      if (!PL.length) { showToast("曲库还没就绪，稍等它下载完"); return; }
      const e = PL[Math.floor(Math.random() * PL.length)];
      $("#rb-result").textContent = `《${e.name}》· ${e.album}`;
      showToast(`今晚就它了：《${e.name}》`);
      Player.playEntry(e);
    });
  }

  /* ---------- 数据日期 ---------- */
  const dd = $("#data-date");
  if (dd && D.meta && D.meta.updated) dd.textContent = D.meta.updated;

  /* ---------- 滚动浮现 & 导航态 ---------- */
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) { e.target.classList.add("vis"); io.unobserve(e.target); }
  }), { threshold: 0.12 });
  document.querySelectorAll(".reveal").forEach(el => io.observe(el));

  const navIO = new IntersectionObserver(es => es.forEach(e => {
    if (e.isIntersecting) {
      document.querySelectorAll(".sidenav a").forEach(a =>
        a.classList.toggle("on", a.getAttribute("href") === "#" + e.target.id));
    }
  }), { threshold: 0.35 });
  document.querySelectorAll("main section").forEach(s => navIO.observe(s));

  /* ---------- TOAST ---------- */
  let toastTimer = null;
  function showToast(msg) {
    const t = $("#toast");
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => t.classList.remove("show"), 2600);
  }
})();
