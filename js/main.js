const PROGRESS_LABEL = { "in-progress": "진행 중", done: "완료" };
let PROJECTS = [];

// Project content now comes through an authenticated write API (see functions/api/admin/save.js),
// not hardcoded data — escape it before it hits innerHTML to avoid stored XSS.
function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function safeRepoHref(repo) {
  return typeof repo === "string" && repo.startsWith("https://") ? escapeHtml(repo) : null;
}

function approachHtml(approach) {
  if (Array.isArray(approach)) {
    return `<ul>${approach.map((m) => `<li>${escapeHtml(m)}</li>`).join("")}</ul>`;
  }
  return `<p>${escapeHtml(approach)}</p>`;
}

// "2026-09-25" → "2026. 9. 25."
function dotDate(iso, withYear = true) {
  const [y, m, d] = iso.split("-").map(Number);
  return withYear ? `${y}. ${m}. ${d}.` : `${m}. ${d}.`;
}

const startOf = (p) => p.start || p.date;

// 이모지는 OS마다 모양·크기가 달라 통일된 인상을 못 만들고 글자색을 따라오지 않는다.
// 획 굵기 1.5 로 맞춘 한 벌만 두고 색은 currentColor 로 받는다.
const ICON = {
  globe: `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.4 8h11.2M8 2.4c1.5 1.6 2.2 3.5 2.2 5.6S9.5 12 8 13.6C6.5 12 5.8 10.1 5.8 8S6.5 4 8 2.4Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
  repo: `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.6 12.4c-2.8.9-2.8-1.4-4-1.7m8 3.3v-2.2c0-.6-.1-1 .3-1.4 1.8-.2 3.5-.9 3.5-3.9a3 3 0 0 0-.8-2.1 2.8 2.8 0 0 0-.1-2.1s-.7-.2-2.3.9a7.8 7.8 0 0 0-4 0C5.6 2.1 4.9 2.3 4.9 2.3a2.8 2.8 0 0 0-.1 2.1 3 3 0 0 0-.8 2.1c0 3 1.7 3.7 3.5 3.9-.3.3-.4.7-.3 1.1v2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

// SCREENSHOTS 는 프로젝트당 배열이다. 첫 장이 목록 미리보기, 전부가 상세에 실린다.
// 예전 형식(문자열 하나)도 그대로 읽히도록 감싸 준다.
function shotsOf(p) {
  const v = SCREENSHOTS[p.id];
  return !v ? [] : Array.isArray(v) ? v : [v];
}

// 대표작 카드의 그림. 스크린샷이 없으면 구조 도식을 쓴다.
function matHtml(p) {
  const src = shotsOf(p)[0];
  const img = src
    ? `<img src="${src}" alt="" loading="lazy">`
    : `<img class="is-diagram" src="assets/diagrams/${escapeHtml(p.id)}.svg" alt="" loading="lazy" onerror="this.remove()">`;
  return `<div class="mat">${img}</div>`;
}

// '완료'는 16개 중 11개라 반복되면 잡음이다. 알려 줄 가치가 있는 '진행 중'만 표시한다.
function statusHtml(p) {
  return p.progress === "done" ? "" : `<span class="st ing">${PROGRESS_LABEL[p.progress]}</span>`;
}

// 대표작: 큰 그림 · 분야 · 제목 · 요약 · 한 줄. 성과 숫자는 도구마다 단위가 달라 늘어놓지 않는다.
function featureHtml(p) {
  return `
    <article class="fcard" data-id="${escapeHtml(p.id)}">
      ${matHtml(p)}
      <div class="fcat"><span>${escapeHtml(p.category)}</span>${statusHtml(p)}</div>
      <h4><button class="row-open" type="button" aria-haspopup="dialog">${escapeHtml(p.title)}</button></h4>
      <p class="fs">${escapeHtml(p.summary || p.problem)}</p>
      ${p.featureNote ? `<p class="ff">${escapeHtml(p.featureNote)}</p>` : ""}
    </article>`;
}

// 나머지는 미리보기 없이 제목과 한 줄. 작은 스크린샷은 대부분 비슷한 회색 표로 보여 알아보는 데 도움이 되지 않았다.
function itemHtml(p) {
  return `
    <article class="it" data-id="${escapeHtml(p.id)}">
      <h4><button class="row-open" type="button" aria-haspopup="dialog">${escapeHtml(p.title)}</button>${statusHtml(p)}</h4>
      <p>${escapeHtml(p.summary || p.problem)}</p>
    </article>`;
}

// 전체를 볼 때: 대표작을 위에 크게, 나머지는 분야별로 묶어 최근 것부터.
// 한 분야만 볼 때: 대표작 칸을 접고 그 분야 전부를 목록으로.
function renderList() {
  const all = activeCategory === "전체";
  const featured = all ? PROJECTS.filter((p) => p.feature).sort((a, b) => a.feature - b.feature) : [];
  const rest = PROJECTS.filter((p) => visible(p) && !featured.includes(p));
  const groups = activeCategories()
    .filter((cat) => all || cat === activeCategory)
    .map((cat) => {
      const items = rest.filter((p) => p.category === cat);
      if (!items.length) return "";
      return `<section class="grp"><h3 class="grp-h">${escapeHtml(cat)}<small>${items.length}</small></h3>${items.map(itemHtml).join("")}</section>`;
    })
    .join("");
  document.getElementById("list").innerHTML = `
    ${featured.length ? `<h3 class="kicker">대표 작업</h3><div class="feat">${featured.map(featureHtml).join("")}</div>` : ""}
    ${all && featured.length ? `<h3 class="kicker">모든 작업</h3>` : ""}
    <div class="groups">${groups}</div>`;
}

// ── 분야 거르기 ─────────────────────────────────────
// 사이드바 한 곳에서 고르면 목록·타임라인 둘 다에 적용된다.
let activeCategory = "전체";

function activeCategories() {
  return CATEGORIES.filter((cat) => PROJECTS.some((p) => p.category === cat));
}

const visible = (p) => activeCategory === "전체" || p.category === activeCategory;

function renderNav() {
  const nav = document.getElementById("tabs");
  const items = [["전체", PROJECTS.length], ...activeCategories().map((c) => [c, PROJECTS.filter((p) => p.category === c).length])];
  // 선택 상태를 색에만 싣지 않는다. aria-pressed 로 눌린 상태를 함께 알린다.
  nav.innerHTML = items
    .map(([cat, n]) => `<button type="button" data-category="${escapeHtml(cat)}" aria-pressed="${cat === activeCategory}">${escapeHtml(cat)}<small>${n}</small></button>`)
    .join("");
  nav.addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-category]");
    if (!btn) return;
    activeCategory = btn.dataset.category;
    nav.querySelectorAll("button").forEach((b) => b.setAttribute("aria-pressed", String(b === btn)));
    applyFilter();
  });
}

function applyFilter() {
  renderList();
  document.getElementById("works-count").textContent = `${PROJECTS.filter(visible).length}건`;
  if (currentView === "timeline") renderTimeline();
}

// ── 타임라인 ────────────────────────────────────────
// 분야마다 한 줄, 칸은 시작일 자리에 놓는다. 칸끼리 겹치면 아랫줄로 내린다.
const EV_PX = 150;
const ROW_PX = 44;
const DAY = 864e5;
const t = (iso) => Date.parse(`${iso}T00:00:00`);
const isoOf = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

function timelineRange() {
  const today = isoOf(new Date());
  const starts = PROJECTS.map(startOf).sort();
  const ends = [...PROJECTS.map((p) => p.date), today].sort();
  const [y0, m0] = starts[0].split("-").map(Number);
  // 한 달을 더 열어 둔다. 월말에 시작한 칸이 오른쪽 끝에 부딪혀 앞 날짜로 밀려나지 않도록.
  let [y1, m1] = ends[ends.length - 1].split("-").map(Number);
  if (++m1 > 12) (m1 = 1), y1++;
  const months = [];
  for (let y = y0, m = m0; y < y1 || (y === y1 && m <= m1); m === 12 ? (y++, (m = 1)) : m++) months.push([y, m]);
  const from = t(`${y0}-${String(m0).padStart(2, "0")}-01`);
  const last = new Date(y1, m1, 1); // 마지막 달의 다음 달 1일
  return { months, from, to: last.getTime(), today };
}

function renderTimeline() {
  const root = document.getElementById("timeline");
  if (!PROJECTS.length) return;
  const { months, from, to, today } = timelineRange();
  const span = to - from;
  const pct = (iso) => ((t(iso) - from) / span) * 100;
  const monthDays = months.map(([y, m]) => new Date(y, m, 0).getDate());

  // 칸 폭을 %로 바꾸려면 실제 레인 폭이 필요하다. 숨어 있을 때는 0 이라 어림값을 쓴다.
  const laneW = Math.max(root.clientWidth - 118, 400);
  const evPct = (EV_PX / laneW) * 100;

  const lanes = activeCategories()
    .filter((c) => activeCategory === "전체" || c === activeCategory)
    .map((cat, li) => {
      const items = PROJECTS.filter((p) => p.category === cat).sort((a, b) => startOf(a).localeCompare(startOf(b)));
      const rowEnds = [];
      const evs = items.map((p) => {
        const left = Math.min(pct(startOf(p)), 100 - evPct);
        let r = rowEnds.findIndex((end) => end <= left);
        if (r === -1) r = rowEnds.push(0) - 1;
        rowEnds[r] = left + evPct + 0.6;
        // 기간: "7. 11. ~ 진행 중" / "7. 16. ~ 8. 27." / 하루짜리는 날짜만
        const from = dotDate(startOf(p), false);
        const sub = p.progress !== "done" ? `${from} ~ 진행 중` : p.date === startOf(p) ? from : `${from} ~ ${dotDate(p.date, false)}`;
        return `<button type="button" class="ev${p.progress === "done" ? "" : " ing"}" data-id="${escapeHtml(p.id)}"
          style="left:${left.toFixed(2)}%;top:${8 + r * ROW_PX}px" title="${escapeHtml(p.title)} · ${dotDate(startOf(p))} 시작">
          <b>${escapeHtml(p.title)}</b><span>${escapeHtml(sub)}</span></button>`;
      });
      const height = 16 + rowEnds.length * ROW_PX;
      let x = 0;
      const grid = monthDays.slice(1).map((d, i) => {
        x += (monthDays[i] / monthDays.reduce((a, b) => a + b, 0)) * 100;
        return `<div class="grid-line" style="left:${x.toFixed(2)}%"></div>`;
      });
      const todayMark = `<div class="today" style="left:${pct(today).toFixed(2)}%">${li === 0 ? `<span class="today-l">오늘 ${dotDate(today, false)}</span>` : ""}</div>`;
      return `
        <div class="lane-name">${escapeHtml(cat)}<small>${items.length}건</small></div>
        <div class="lane" style="height:${height}px">${grid.join("")}${todayMark}${evs.join("")}</div>`;
    });

  const monthHead = `<div class="months" style="grid-template-columns:${monthDays.map((d) => `${d}fr`).join(" ")}">${months
    .map(([, m]) => `<span>${m}월</span>`)
    .join("")}</div>`;

  // 휴대폰: 달력 대신 최근 것부터 월별 목록
  const byMonth = new Map();
  PROJECTS.filter(visible)
    .slice()
    .sort((a, b) => startOf(b).localeCompare(startOf(a)))
    .forEach((p) => {
      const key = startOf(p).slice(0, 7);
      if (!byMonth.has(key)) byMonth.set(key, []);
      byMonth.get(key).push(p);
    });
  const mlist = [...byMonth]
    .map(([key, list]) => {
      const [y, m] = key.split("-").map(Number);
      return `<div class="mmonth">${y}년 ${m}월<small>${list.length}건</small></div>${list
        .map(
          (p) => `<button type="button" class="mitem${p.progress === "done" ? "" : " ing"}" data-id="${escapeHtml(p.id)}">
            <time>${dotDate(startOf(p), false)}</time><b>${escapeHtml(p.title)}</b><em>${PROGRESS_LABEL[p.progress]}</em></button>`
        )
        .join("")}`;
    })
    .join("");

  root.innerHTML = `
    <div class="cal"><div></div>${monthHead}${lanes.join("")}</div>
    <div class="legend"><span><i></i>완료</span><span><i class="ing"></i>진행 중</span><span>칸은 시작한 날 자리 · 누르면 자세히</span></div>
    <div class="mlist">${mlist}</div>`;
}

// ── 보기 전환 · 주소 ────────────────────────────────
// #timeline 은 보기, 그 밖의 #xxx 는 프로젝트 상세. 프로젝트 ID 에 timeline 은 쓰지 않는다.
let currentView = "list";

function setView(view) {
  currentView = view;
  document.getElementById("list").hidden = view !== "list";
  document.getElementById("timeline").hidden = view !== "timeline";
  document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.view === view)));
  if (view === "timeline") renderTimeline();
}

function setupViews() {
  document.querySelector(".seg").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-view]");
    if (!btn) return;
    setView(btn.dataset.view);
    // 보기 바꾸기는 뒤로 가기 기록을 쌓지 않는다. 주소만 맞춰 두어 즐겨찾기·공유가 되게 한다.
    history.replaceState(null, "", btn.dataset.view === "timeline" ? "#timeline" : location.pathname);
  });

  let timer;
  window.addEventListener("resize", () => {
    clearTimeout(timer);
    timer = setTimeout(() => currentView === "timeline" && renderTimeline(), 150);
  });
}

// ── 상세 ────────────────────────────────────────────
// '비공개' 칩은 원래 '코드 저장소가 비공개'라는 뜻인데 방문자에게는 '숨긴 작업'으로 읽혔다.
// 코드가 공개된 작업은 아래 GitHub 링크가 그 사실을 말하므로 상태만 남긴다.
function chipsHtml(p) {
  return `
    <div class="chips">
      <span class="chip chip-${p.progress}"><span class="dot"></span>${PROGRESS_LABEL[p.progress]}</span>
    </div>`;
}

function footerHtml(p) {
  const href = safeRepoHref(p.repo);
  const site = safeRepoHref(p.site);
  const period = p.start && p.start !== p.date ? `${dotDate(p.start)} 시작 · ${dotDate(p.date)} 갱신` : dotDate(p.date);
  return `
    <div class="card-footer">
      <div class="meta-group">
        ${site ? `<a class="repo-link" href="${site}" target="_blank" rel="noopener">${ICON.globe}사이트</a>` : ""}
        ${href ? `<a class="repo-link" href="${href}" target="_blank" rel="noopener">${ICON.repo}GitHub</a>` : ""}
        <span>${period}</span>
      </div>
    </div>`;
}

// 도식은 있으면 쓰고 없으면 만다. 목록 파일을 두지 않아, 그림을 추가할 때 파일만 넣으면 된다.
// 주의: Pages 는 없는 파일에 404 가 아니라 index.html(200) 을 돌려준다. 그래도 <img> 가
// HTML 을 이미지로 디코딩하지 못해 error 가 나므로 아래 onerror 로 잡힌다.
function diagramHtml(p) {
  return `
    <div class="diagram-block">
      <h4>구조</h4>
      <figure class="diagram">
        <img src="assets/diagrams/${escapeHtml(p.id)}.svg" alt="${escapeHtml(p.title)} 구조 도식"
             onerror="this.closest('.diagram-block').remove()">
      </figure>
    </div>`;
}

function shotHtml(p) {
  const list = shotsOf(p);
  if (!list.length) return "";
  const figures = list
    .map((src, i) => {
      const label = `${escapeHtml(p.title)} 스크린샷${list.length > 1 ? ` ${i + 1}` : ""}`;
      return `
      <figure class="diagram shot-zoom">
        <img src="${src}" alt="${label}" tabindex="0" role="button" aria-label="${label} — 눌러서 크게 보기">
      </figure>`;
    })
    .join("");
  return `<h4>화면${list.length > 1 ? ` <span class="count">${list.length}장</span>` : ""}</h4>${figures}`;
}

// 소개 영상. 누르기 전에는 받지 않고(preload="none") 포스터만 보인다 — 상세를 여는 것만으로 4MB 를 쓰지 않게.
function videoHtml(p) {
  if (!p.video) return "";
  const src = escapeHtml(p.video);
  return `
      <h4>영상</h4>
      <figure class="diagram video">
        <video controls preload="none" playsinline poster="${src.replace(/\.mp4$/, ".jpg")}" aria-label="${escapeHtml(p.title)} 소개 영상">
          <source src="${src}" type="video/mp4">
        </video>
      </figure>`;
}

function detailHtml(p) {
  return `
    <div class="dialog-head">
      <span class="cat">${escapeHtml(p.category)}</span>
      <h3 id="detail-title" tabindex="-1">${escapeHtml(p.title)}</h3>
      ${chipsHtml(p)}
    </div>
    <div class="dialog-body">
      ${p.result ? `<h4>결과</h4><p class="result">${escapeHtml(p.result)}</p>` : ""}
      ${videoHtml(p)}
      ${shotHtml(p)}
      <h4>문제</h4>
      <p>${escapeHtml(p.problem)}</p>
      <h4>접근</h4>
      ${approachHtml(p.approach)}
      ${diagramHtml(p)}
      ${footerHtml(p)}
    </div>`;
}

// pushState (not location.hash =) on purpose: Cloudflare Web Analytics hooks the History API
// to count in-page navigation, so this is what makes "detail reach" measurable. It also makes
// each project linkable and lets the back button close the dialog.
function openProject(id, push) {
  const project = PROJECTS.find((p) => p.id === id);
  if (!project) return;
  const dialog = document.getElementById("detail-dialog");
  document.getElementById("detail-content").innerHTML = detailHtml(project);
  if (!dialog.open) dialog.showModal();
  // showModal 은 첫 버튼(✕)에 포커스를 줘서 열자마자 테두리가 켜져 보였다.
  // 제목으로 옮기면 화면이 조용하고, 스크린리더는 무엇이 열렸는지 제목부터 읽는다.
  document.getElementById("detail-title").focus({ preventScroll: true });
  if (push) history.pushState({ id }, "", `#${id}`);
}

function setupDialog() {
  const dialog = document.getElementById("detail-dialog");

  // 목록 행·타임라인 칸·첫 화면 숫자 어디를 눌러도 같은 상세가 열린다.
  document.getElementById("works").addEventListener("click", (e) => {
    if (e.target.closest(".repo-link")) return;
    const hit = e.target.closest("[data-id], [data-open]");
    if (!hit) return;
    openProject(hit.dataset.id || hit.dataset.open, true);
  });

  dialog.querySelector(".dialog-close").addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  // Covers the ✕, the backdrop, and Esc in one place. 닫으면 보던 보기의 주소로 돌아간다.
  dialog.addEventListener("close", () => {
    const back = currentView === "timeline" ? "#timeline" : "";
    if (location.hash && location.hash !== back) history.pushState(null, "", back || location.pathname);
  });

  window.addEventListener("popstate", () => {
    const hash = location.hash.slice(1);
    if (!hash || hash === "timeline") {
      if (dialog.open) dialog.close();
      setView(hash === "timeline" ? "timeline" : "list");
    } else {
      openProject(hash, false);
    }
  });

  setupShotZoom();
}

// 원본 보기는 <dialog> 하나로 끝난다 — Esc·포커스 복귀·바깥 클릭을 브라우저가 맡는다.
function setupShotZoom() {
  const shotDialog = document.getElementById("shot-dialog");
  const big = shotDialog.querySelector("img");

  const open = (img) => {
    big.src = img.src;
    big.alt = img.alt;
    shotDialog.showModal();
  };

  const content = document.getElementById("detail-content");
  content.addEventListener("click", (e) => {
    const img = e.target.closest(".shot-zoom img");
    if (img) open(img);
  });
  content.addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    const img = e.target.closest(".shot-zoom img");
    if (!img) return;
    e.preventDefault();
    open(img);
  });

  // 그림 자체가 아닌 곳(바깥 여백·✕)을 누르면 닫는다.
  shotDialog.addEventListener("click", (e) => {
    if (e.target !== big) shotDialog.close();
  });
}

function setupContact() {
  const dialog = document.getElementById("contact-dialog");
  const form = document.getElementById("contact-form");
  const msg = document.getElementById("contact-msg");
  const sendBtn = document.getElementById("contact-send");

  // 사이드바 버튼과 휴대폰 머리말 버튼 둘 다
  document.querySelectorAll("[data-contact]").forEach((btn) =>
    btn.addEventListener("click", () => {
      msg.textContent = "";
      form.reset();
      dialog.showModal();
    })
  );
  document.getElementById("contact-cancel").addEventListener("click", () => dialog.close());

  form.addEventListener("submit", async (e) => {
    // method="dialog" 라 기본 동작은 그냥 닫기 — 전송이 끝날 때까지 막는다.
    e.preventDefault();
    sendBtn.disabled = true;
    msg.textContent = "보내는 중...";

    const data = Object.fromEntries(new FormData(form));
    try {
      const res = await fetch("/api/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        msg.textContent = "보냈습니다. 확인 후 연락드리겠습니다.";
        form.reset();
        // 1.5초는 "보냈습니다"를 읽기도 전에 사라지는 길이다. 스크린리더가 다 읽을 시간을 준다.
        setTimeout(() => dialog.close(), 3200);
      } else if (res.status === 429) {
        msg.textContent = "잠시 후 다시 시도해 주세요.";
      } else {
        msg.textContent = "전송에 실패했습니다. 모든 칸을 채웠는지 확인해 주세요.";
      }
    } catch {
      msg.textContent = "전송에 실패했습니다. 네트워크를 확인해 주세요.";
    }
    sendBtn.disabled = false;
  });
}

async function init() {
  setupContact();
  const list = document.getElementById("list");
  try {
    const res = await fetch("/api/projects");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    PROJECTS = await res.json();
  } catch (err) {
    list.innerHTML = `<p class="empty">프로젝트 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.</p>`;
    return;
  }
  // 최근에 손본 것부터. ISO dates sort correctly as plain strings — that is why the schema uses them.
  PROJECTS.sort((a, b) => b.date.localeCompare(a.date));

  const latest = PROJECTS[0]?.date;
  if (latest) document.getElementById("last-update").textContent = `마지막 갱신 ${dotDate(latest)}`;

  renderNav();
  setupViews();
  setupDialog();
  applyFilter();

  // /#timeline 은 타임라인으로, /#hapbul 같은 공유 링크는 그 프로젝트로 바로 연다.
  const hash = location.hash.slice(1);
  if (hash === "timeline") setView("timeline");
  else if (hash) openProject(hash, false);
}

init();
