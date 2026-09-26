// 편집 화면 (2026-09-26 개편): 표 목록 → 한 프로젝트 편집, Ctrl+K 로 이동.
// 서버와 주고받는 것은 예전과 같다 — 전체 배열을 받아 전체 배열을 저장한다.
//   /edit/            목록
//   /edit/#<프로젝트ID> 그 프로젝트 편집
//   /edit/#inbox       받은 문의
const $ = (id) => document.getElementById(id);
const loginSection = $("login-section");
const editorSection = $("editor-section");
const view = $("view");

let projects = []; // 각 항목에 저장되지 않는 내부 키 _k 를 붙여 둔다 (ID 는 편집 중에 바뀔 수 있어서)
let baseline = new Map(); // _k → 마지막으로 저장한 상태
let messages = [];
let keySeq = 0;

function esc(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

const clean = ({ _k, ...rest }) => rest;
const snap = (p) => JSON.stringify(clean(p));
const withKey = (p) => ({ ...p, _k: ++keySeq });
const startOf = (p) => p.start || p.date;
const dotDate = (iso) => (iso ? iso.slice(5).split("-").map(Number).join(". ") + "." : "");
const shotsOf = (p) => {
  const v = SCREENSHOTS[p.id];
  return !v ? [] : Array.isArray(v) ? v : [v];
};

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function approachToText(approach) {
  return Array.isArray(approach) ? approach.join("\n") : approach || "";
}

function textToApproach(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length <= 1 ? lines[0] || "" : lines;
}

// 목록에서 '손볼 곳'으로 모이는 기준 — 사이트에서 비어 보이는 것들.
function missing(p) {
  const m = [];
  if (!p.summary?.trim()) m.push("요약");
  if (!p.result?.trim()) m.push("결과");
  if (!shotsOf(p).length) m.push("스크린샷");
  return m;
}

// ── 저장 안 된 변경 ─────────────────────────────────
function setBaseline() {
  baseline = new Map(projects.map((p) => [p._k, snap(p)]));
}

function dirtyCount() {
  const alive = new Set(projects.map((p) => p._k));
  let n = projects.filter((p) => baseline.get(p._k) !== snap(p)).length;
  for (const k of baseline.keys()) if (!alive.has(k)) n++;
  return n;
}

function updateDirty() {
  const n = dirtyCount();
  $("dirty").hidden = !n;
  $("dirty").textContent = `저장 안 된 변경 ${n}건`;
}

let toastTimer;
function toast(text, ms = 3500) {
  const el = $("toast");
  el.textContent = text;
  el.classList.add("on");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove("on"), ms);
}

// ── 목록 ────────────────────────────────────────────
const list = { q: "", chip: "all", cat: "", sort: "date", dir: -1 };
let order = []; // 이전/다음 이동에 쓰는, 목록에서 마지막으로 본 순서 (_k)

const CHIPS = [
  ["all", "전체", () => true],
  ["feature", "대표작", (p) => p.feature],
  ["ing", "진행 중", (p) => p.progress !== "done"],
  ["miss", "손볼 곳", (p) => missing(p).length],
];

const SORTS = {
  title: (p) => p.title,
  category: (p) => CATEGORIES.indexOf(p.category),
  progress: (p) => (p.progress === "done" ? 1 : 0),
  feature: (p) => p.feature || 99,
  miss: (p) => -missing(p).length,
  start: startOf,
  date: (p) => p.date,
};

function filtered() {
  const q = list.q.trim().toLowerCase();
  const test = CHIPS.find(([k]) => k === list.chip)[2];
  const key = SORTS[list.sort];
  return projects
    .filter((p) => test(p) && (!list.cat || p.category === list.cat) && (!q || p.title.toLowerCase().includes(q) || p.id.includes(q)))
    .sort((a, b) => {
      const x = key(a), y = key(b);
      return (x < y ? -1 : x > y ? 1 : 0) * list.dir || b.date.localeCompare(a.date);
    });
}

function renderListView() {
  view.className = "e-home";
  view.innerHTML = `
    <div class="e-tools">
      <input id="q" class="e-search" type="search" placeholder="제목·ID로 찾기" value="${esc(list.q)}" aria-label="프로젝트 찾기">
      <div class="e-chips" id="chips" role="group" aria-label="거르기"></div>
      <select id="cat" class="e-select" aria-label="분야">
        <option value="">분야: 전체</option>
        ${CATEGORIES.map((c) => `<option value="${esc(c)}" ${c === list.cat ? "selected" : ""}>${esc(c)}</option>`).join("")}
      </select>
      <span class="e-spacer"></span>
      <button type="button" id="add-btn" class="e-btn e-primary">+ 새 프로젝트</button>
    </div>
    <div class="e-table-wrap">
      <table class="e-table">
        <thead><tr>
          ${[["title", "제목"], ["category", "분야"], ["progress", "상태"], ["feature", "대표"], ["miss", "손볼 곳"], ["start", "시작일"], ["date", "갱신일"]]
            .map(([k, label]) => `<th data-sort="${k}" aria-sort="${list.sort === k ? (list.dir < 0 ? "descending" : "ascending") : "none"}"><button type="button">${label}</button></th>`)
            .join("")}
        </tr></thead>
        <tbody id="rows"></tbody>
      </table>
    </div>
    <p class="e-foot" id="list-foot"></p>`;

  $("q").addEventListener("input", (e) => { list.q = e.target.value; renderRows(); });
  $("cat").addEventListener("change", (e) => { list.cat = e.target.value; renderRows(); });
  $("chips").addEventListener("click", (e) => {
    const b = e.target.closest("button[data-chip]");
    if (!b) return;
    list.chip = b.dataset.chip;
    renderRows();
  });
  view.querySelector("thead").addEventListener("click", (e) => {
    const th = e.target.closest("th[data-sort]");
    if (!th) return;
    const k = th.dataset.sort;
    list.dir = list.sort === k ? -list.dir : k === "title" || k === "category" ? 1 : -1;
    list.sort = k;
    view.querySelectorAll("th").forEach((t) => t.setAttribute("aria-sort", t.dataset.sort === k ? (list.dir < 0 ? "descending" : "ascending") : "none"));
    renderRows();
  });
  $("rows").addEventListener("click", (e) => {
    const tr = e.target.closest("tr[data-id]");
    if (tr) location.hash = encodeURIComponent(tr.dataset.id);
  });
  $("add-btn").addEventListener("click", addProject);
  renderRows();
}

function renderRows() {
  $("chips").innerHTML = CHIPS.map(
    ([k, label, test]) =>
      `<button type="button" data-chip="${k}" aria-pressed="${list.chip === k}" class="${k === "miss" ? "warn" : ""}">${label}<b>${projects.filter(test).length}</b></button>`
  ).join("");
  const rows = filtered();
  order = rows.map((p) => p._k);
  $("rows").innerHTML = rows.length
    ? rows
        .map((p) => {
          const m = missing(p);
          return `
        <tr data-id="${esc(p.id)}" tabindex="0">
          <td class="t"><b>${esc(p.title)}</b><small>${esc(p.id)}</small>${baseline.get(p._k) !== snap(p) ? `<i class="e-changed" title="저장 안 된 변경">●</i>` : ""}</td>
          <td class="m">${esc(p.category)}</td>
          <td>${p.progress === "done" ? `<span class="m">완료</span>` : `<span class="e-ing">● 진행 중</span>`}</td>
          <td>${p.feature ? `<span class="e-star">★ ${p.feature}</span>` : ""}</td>
          <td>${m.length ? `<span class="e-miss">${m.join(" · ")} 없음</span>` : `<span class="e-ok">✓</span>`}</td>
          <td class="m">${dotDate(startOf(p))}</td>
          <td>${dotDate(p.date)}</td>
        </tr>`;
        })
        .join("")
    : `<tr><td colspan="7" class="m e-empty">조건에 맞는 프로젝트가 없습니다.</td></tr>`;
  $("list-foot").textContent = `${rows.length}건 / 전체 ${projects.length}건 · 줄을 누르면 편집 · 열 제목을 누르면 정렬`;
}

// 줄에 포커스를 두고 Enter 로도 연다
view.addEventListener("keydown", (e) => {
  if (e.key !== "Enter") return;
  const tr = e.target.closest("tr[data-id]");
  if (tr) location.hash = encodeURIComponent(tr.dataset.id);
});

function newId() {
  let n = projects.length + 1;
  while (projects.some((p) => p.id === `new-project-${n}`)) n++;
  return `new-project-${n}`;
}

function addProject() {
  const p = withKey({
    id: newId(),
    title: "새 프로젝트",
    summary: "",
    category: list.cat || CATEGORIES[0],
    tags: [],
    date: todayStr(),
    problem: "",
    approach: "",
    result: "",
    progress: "in-progress",
    visibility: "private",
  });
  projects.push(p);
  updateDirty();
  location.hash = encodeURIComponent(p.id);
  toast("추가됨 — ID·제목·문제를 채우고 저장하세요.");
}

// ── 편집 ────────────────────────────────────────────
const SECTIONS = [
  ["basic", "기본"],
  ["card", "목록에 보이는 글"],
  ["feature", "대표작"],
  ["detail", "상세 내용"],
  ["shots", "화면"],
  ["dates", "날짜와 링크"],
];

function seg(name, options, value) {
  return `<div class="e-seg" role="radiogroup">${options
    .map(([v, label]) => `<label><input type="radio" name="${name}" value="${esc(v)}" ${String(value) === String(v) ? "checked" : ""}><span>${label}</span></label>`)
    .join("")}</div>`;
}

function field(label, control, note = "") {
  return `<div class="e-f"><div class="e-label"><span>${label}</span>${note}</div>${control}</div>`;
}

const count = (name, n, max) => `<i class="e-count" data-count="${name}" data-max="${max}">${n} / ${max}</i>`;

function featureHint(p) {
  const taken = projects
    .filter((x) => x !== p && x.feature)
    .sort((a, b) => a.feature - b.feature)
    .map((x) => `${x.feature}번 ${x.title}`);
  return taken.length ? `지금: ${taken.join(" · ")} — 이미 쓰는 번호를 고르면 그 작업은 대표작에서 빠집니다` : "아직 대표작이 없습니다";
}

function renderEditor(p) {
  view.className = "e-ed";
  const seq = order.length && order.includes(p._k) ? order : filtered().map((x) => x._k);
  const i = seq.indexOf(p._k);
  const prev = projects.find((x) => x._k === seq[i - 1]);
  const next = projects.find((x) => x._k === seq[i + 1]);
  const shots = shotsOf(p);

  view.innerHTML = `
    <div class="e-crumb">
      <a href="#">← 목록</a><span>›</span><span id="crumb-cat">${esc(p.category)}</span><span>›</span><b id="crumb-title">${esc(p.title)}</b>
      <span class="e-spacer"></span>
      <a class="e-pn" ${prev ? `href="#${encodeURIComponent(prev.id)}" title="${esc(prev.title)}"` : 'aria-disabled="true"'}>‹ 이전</a>
      <span class="m">${i + 1} / ${seq.length}</span>
      <a class="e-pn" ${next ? `href="#${encodeURIComponent(next.id)}" title="${esc(next.title)}"` : 'aria-disabled="true"'}>다음 ›</a>
    </div>
    <form class="e-form" id="form" autocomplete="off">
      <div class="e-head">
        <small><span id="head-id">${esc(p.id)}</span> · <a href="../#${esc(p.id)}" target="_blank" rel="noopener">사이트에서 보기 ↗</a></small>
        <h2 id="head-title">${esc(p.title)}</h2>
      </div>

      <fieldset id="sec-basic" class="e-fs"><legend>기본</legend>
        <div class="e-g2">
          ${field("제목", `<input name="title" value="${esc(p.title)}" required>`)}
          ${field("ID", `<input name="id" value="${esc(p.id)}" pattern="[a-z0-9-]+" required>`, `<i>영문 소문자·숫자·하이픈 · 스크린샷 폴더 이름이라 바꾸면 그림이 끊김</i>`)}
        </div>
        <div class="e-g3">
          ${field("분야", `<select name="category">${CATEGORIES.map((c) => `<option ${c === p.category ? "selected" : ""}>${esc(c)}</option>`).join("")}</select>`)}
          ${field("상태", seg("progress", [["in-progress", "진행 중"], ["done", "완료"]], p.progress))}
          ${field("코드", seg("visibility", [["public", "공개"], ["private", "비공개"]], p.visibility))}
        </div>
      </fieldset>

      <fieldset id="sec-card" class="e-fs"><legend>목록에 보이는 글</legend>
        ${field("한 줄 요약", `<input name="summary" maxlength="60" value="${esc(p.summary)}" placeholder="예) 9등급 시절 대입 결과를 5등급 학생과 같은 잣대로 바꿔 비교">`, count("summary", (p.summary || "").length, 60))}
      </fieldset>

      <fieldset id="sec-feature" class="e-fs"><legend>대표작 <small>첫 화면 위쪽의 큰 카드 · 최대 3개</small></legend>
        <div class="e-g2">
          ${field("순서", seg("feature", [["", "아님"], ["1", "1"], ["2", "2"], ["3", "3"]], p.feature || ""))}
          ${field("카드 아래 한 줄", `<input name="featureNote" maxlength="40" value="${esc(p.featureNote || "")}" placeholder="예) 3·6·9월 정규 업무로 사용">`, count("featureNote", (p.featureNote || "").length, 40))}
        </div>
        <p class="e-hint" id="feature-hint">${esc(featureHint(p))}</p>
      </fieldset>

      <fieldset id="sec-detail" class="e-fs"><legend>상세 내용 <small>사이트와 같은 순서</small></legend>
        ${field("결과", `<textarea name="result" rows="4" placeholder="실제로 쓰이고 있다는 근거. 없으면 비워 두세요.">${esc(p.result)}</textarea>`, `<i>없으면 비움</i>`)}
        ${field("문제", `<textarea name="problem" rows="4" required>${esc(p.problem)}</textarea>`, `<i>필수</i>`)}
        ${field("접근", `<textarea name="approach" rows="6">${esc(approachToText(p.approach))}</textarea>`, `<i>한 줄에 하나</i>`)}
      </fieldset>

      <fieldset id="sec-shots" class="e-fs"><legend>화면 <small>그림 파일은 저장소에 넣고 배포 (README §2)</small></legend>
        ${shots.length
          ? `<div class="e-shots">${shots.map((src) => `<a href="../${src}" target="_blank" rel="noopener"><img src="../${src}" alt="" loading="lazy"></a>`).join("")}</div>`
          : `<p class="e-hint">아직 스크린샷이 없습니다. <code>assets/screenshots/${esc(p.id)}/</code> 에 넣고 배포하세요.</p>`}
        ${field("대표작 카드에서 보여 줄 부분", seg("shot", [["center", "가운데"], ["top", "위쪽"], ["bottom", "아래쪽"], ["fit", "전체"]], p.shot || "center"))}
        ${field("소개 영상", `<input name="video" value="${esc(p.video || "")}" placeholder="assets/videos/${esc(p.id)}.mp4" pattern="assets/videos/[a-z0-9-]+\.mp4">`, `<i>선택 · 파일은 저장소에 넣고 배포 · 같은 이름 .jpg 가 포스터</i>`)}
      </fieldset>

      <fieldset id="sec-dates" class="e-fs"><legend>날짜와 링크</legend>
        <div class="e-g2">
          ${field("시작일", `<input type="date" name="start" value="${esc(p.start || "")}">`, `<i>타임라인 칸 자리 · 비우면 갱신일</i>`)}
          ${field("마지막 갱신일", `<input type="date" name="date" value="${esc(p.date)}" required>`)}
          ${field("GitHub", `<input type="url" name="repo" value="${esc(p.repo || "")}" placeholder="https://github.com/…">`)}
          ${field("사이트 주소", `<input type="url" name="site" value="${esc(p.site || "")}" placeholder="https://…">`)}
        </div>
      </fieldset>
    </form>
    <nav class="e-toc" aria-label="이 프로젝트 안에서 이동">
      ${SECTIONS.map(([id, label]) => `<a href="#sec-${id}" data-sec="${id}">${label}</a>`).join("")}
      <button type="button" class="e-del" id="del-btn">이 프로젝트 삭제</button>
    </nav>`;

  const form = $("form");
  form.addEventListener("input", (e) => applyField(p, e.target));
  form.addEventListener("change", (e) => applyField(p, e.target));
  form.addEventListener("submit", (e) => e.preventDefault());
  $("del-btn").addEventListener("click", () => {
    if (!confirm(`"${p.title}" 프로젝트를 목록에서 삭제할까요?\n(저장을 눌러야 실제로 반영됩니다)`)) return;
    projects.splice(projects.indexOf(p), 1);
    updateDirty();
    location.hash = "";
    toast(`"${p.title}" 삭제됨 — 저장해야 반영됩니다.`);
  });

  // 목차: 눌러서 건너뛰기(주소의 #프로젝트ID 는 그대로 둔다) + 지금 보는 칸 표시
  view.querySelector(".e-toc").addEventListener("click", (e) => {
    const a = e.target.closest("a[data-sec]");
    if (!a) return;
    e.preventDefault();
    $(`sec-${a.dataset.sec}`).scrollIntoView({ behavior: "smooth", block: "start" });
  });
  const links = view.querySelectorAll(".e-toc a[data-sec]");
  const io = new IntersectionObserver(
    (entries) => {
      const top = entries.filter((x) => x.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
      if (top) links.forEach((l) => l.classList.toggle("on", `sec-${l.dataset.sec}` === top.target.id));
    },
    { rootMargin: "-80px 0px -55% 0px" }
  );
  SECTIONS.forEach(([id]) => io.observe($(`sec-${id}`)));
  links[0].classList.add("on");
}

function applyField(p, el) {
  const name = el.name;
  if (!name) return;
  const v = el.value;
  if (name === "feature") {
    const n = parseInt(v, 10);
    if (n >= 1) {
      // 같은 번호는 하나만 — 이미 쓰던 작업은 대표작에서 뺀다
      projects.forEach((x) => { if (x !== p && x.feature === n) delete x.feature; });
      p.feature = n;
    } else delete p.feature;
    $("feature-hint").textContent = featureHint(p);
  } else if (name === "shot") {
    if (v && v !== "center") p.shot = v;
    else delete p.shot;
  } else if (name === "approach") {
    p.approach = textToApproach(v);
  } else if (["repo", "site", "start", "featureNote", "video"].includes(name)) {
    const t = v.trim();
    if (t) p[name] = t;
    else delete p[name];
  } else {
    p[name] = v;
  }

  if (name === "title") {
    $("head-title").textContent = v;
    $("crumb-title").textContent = v;
  }
  if (name === "category") $("crumb-cat").textContent = v;
  if (name === "id") {
    $("head-id").textContent = v;
    // 주소도 따라가게 — hashchange 를 일으키지 않도록 replaceState
    history.replaceState(null, "", `#${encodeURIComponent(v)}`);
  }
  const c = view.querySelector(`[data-count="${name}"]`);
  if (c) {
    c.textContent = `${v.length} / ${c.dataset.max}`;
    c.classList.toggle("near", v.length > c.dataset.max * 0.9);
  }
  updateDirty();
}

// ── 받은 문의 ───────────────────────────────────────
async function loadMessages() {
  const res = await fetch("/api/admin/messages");
  if (!res.ok) return;
  messages = await res.json();
  const badge = $("inbox-count");
  badge.hidden = !messages.length;
  badge.textContent = messages.length;
  if (location.hash === "#inbox") renderInbox();
}

function renderInbox() {
  view.className = "e-inbox";
  view.innerHTML = messages.length
    ? messages
        .map((m) => {
          const where = [m.region, m.country].filter(Boolean).join(" · ");
          return `
      <article class="e-msg-item">
        <div class="e-msg-head">
          <b>${esc(m.name)}</b>
          <button type="button" class="e-link" data-copy="${esc(m.contact)}">${esc(m.contact)} · 복사</button>
          <span class="m">${where ? esc(where) : ""}</span>
          <span class="e-spacer"></span>
          <span class="m">${esc(m.at.slice(0, 16).replace("T", " "))}</span>
          <button type="button" class="e-link e-danger" data-del="${esc(m.at)}">삭제</button>
        </div>
        <p>${esc(m.message)}</p>
      </article>`;
        })
        .join("")
    : `<p class="m e-empty">받은 문의가 없습니다.</p>`;
}

view.addEventListener("click", async (e) => {
  const copy = e.target.closest("[data-copy]");
  if (copy) {
    try {
      await navigator.clipboard.writeText(copy.dataset.copy);
      toast("연락처를 복사했습니다.");
    } catch {
      toast(copy.dataset.copy, 6000);
    }
    return;
  }
  const del = e.target.closest("[data-del]");
  if (del) {
    if (!confirm("이 문의를 삭제할까요?")) return;
    await fetch(`/api/admin/messages?at=${encodeURIComponent(del.dataset.del)}`, { method: "DELETE" });
    loadMessages();
  }
});

// ── 이동 ────────────────────────────────────────────
function route() {
  const h = decodeURIComponent(location.hash.slice(1));
  document.querySelectorAll(".e-tabs a").forEach((a) =>
    a.setAttribute("aria-current", String((a.dataset.tab === "inbox") === (h === "inbox")))
  );
  if (!h) renderListView();
  else if (h === "inbox") renderInbox();
  else {
    const p = projects.find((x) => x.id === h);
    if (p) renderEditor(p);
    else {
      toast(`"${h}" 프로젝트를 찾지 못했습니다.`);
      history.replaceState(null, "", location.pathname);
      renderListView();
    }
  }
  window.scrollTo(0, 0);
}

window.addEventListener("hashchange", route);

// Ctrl+K
const jumpDialog = $("jump-dialog");
const jumpInput = $("jump-input");
const jumpResults = $("jump-results");
let jumpSel = 0;

function jumpMatches() {
  const q = jumpInput.value.trim().toLowerCase();
  if (!q) return projects.slice().sort((a, b) => b.date.localeCompare(a.date)).slice(0, 8);
  return projects
    .map((p) => {
      const t = p.title.toLowerCase();
      const at = t.indexOf(q);
      const rank = at === 0 ? 0 : at > 0 ? 1 : p.id.includes(q) ? 2 : 9;
      return [rank, p];
    })
    .filter(([r]) => r < 9)
    .sort((a, b) => a[0] - b[0])
    .map(([, p]) => p)
    .slice(0, 8);
}

function renderJump() {
  const found = jumpMatches();
  jumpSel = Math.min(jumpSel, Math.max(found.length - 1, 0));
  jumpResults.innerHTML = found.length
    ? found
        .map((p, i) => `<li role="option" aria-selected="${i === jumpSel}" data-id="${esc(p.id)}"><span>${esc(p.title)}</span><small>${esc(p.category)}</small></li>`)
        .join("")
    : `<li class="m">없음</li>`;
  return found;
}

function openJump() {
  jumpInput.value = "";
  jumpSel = 0;
  renderJump();
  jumpDialog.showModal();
  jumpInput.focus();
}

jumpInput.addEventListener("input", () => { jumpSel = 0; renderJump(); });
jumpInput.addEventListener("keydown", (e) => {
  const found = jumpMatches();
  if (e.key === "ArrowDown") { jumpSel = Math.min(jumpSel + 1, found.length - 1); renderJump(); e.preventDefault(); }
  else if (e.key === "ArrowUp") { jumpSel = Math.max(jumpSel - 1, 0); renderJump(); e.preventDefault(); }
  else if (e.key === "Enter" && found[jumpSel]) { jumpDialog.close(); location.hash = encodeURIComponent(found[jumpSel].id); }
});
jumpResults.addEventListener("click", (e) => {
  const li = e.target.closest("li[data-id]");
  if (!li) return;
  jumpDialog.close();
  location.hash = encodeURIComponent(li.dataset.id);
});
jumpDialog.addEventListener("click", (e) => { if (e.target === jumpDialog) jumpDialog.close(); });
$("jump-btn").addEventListener("click", openJump);

document.addEventListener("keydown", (e) => {
  if (editorSection.hidden || !(e.ctrlKey || e.metaKey)) return;
  const k = e.key.toLowerCase();
  if (k === "s") { e.preventDefault(); save(); }
  else if (k === "k") { e.preventDefault(); openJump(); }
});

// ── 저장 · 백업 · 로그인 ─────────────────────────────
async function save() {
  toast("저장 중...", 20000);
  const body = projects.map(clean);
  const res = await fetch("/api/admin/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (res.ok) {
    setBaseline();
    updateDirty();
    if (!location.hash) renderRows();
    toast("저장됨 — 사이트에 바로 반영됩니다.");
    return;
  }
  const err = await res.json().catch(() => ({}));
  if (err.error === "invalid_shape") {
    const bad = projects[err.index];
    toast(`"${bad?.title}" — 필수 항목(ID·제목·문제·갱신일)이 비었거나 형식이 잘못됐습니다.`, 8000);
    if (bad) location.hash = encodeURIComponent(bad.id);
  } else if (err.error === "duplicate_id") {
    toast(`ID가 겹칩니다: ${err.id}`, 8000);
  } else {
    toast("저장 실패 — 다시 로그인해 보세요.", 8000);
  }
}

$("save-btn").addEventListener("click", save);

$("backup-btn").addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(projects.map(clean), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `portfolio-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
  document.querySelector(".e-more").open = false;
});

$("logout-btn").addEventListener("click", async () => {
  if (dirtyCount() && !confirm("저장하지 않은 변경이 있습니다. 그래도 로그아웃할까요?")) return;
  await fetch("/api/logout", { method: "POST" });
  editorSection.hidden = true;
  loginSection.hidden = false;
  document.querySelector(".e-more").open = false;
});

// 저장 안 한 채 창을 닫거나 다른 주소로 가려 하면 브라우저가 한 번 묻는다
window.addEventListener("beforeunload", (e) => {
  if (!editorSection.hidden && dirtyCount()) {
    e.preventDefault();
    e.returnValue = "";
  }
});

async function tryLoadEditor() {
  const res = await fetch("/api/admin/data");
  if (res.status === 401) return false;
  projects = (await res.json()).map(withKey);
  setBaseline();
  updateDirty();
  loginSection.hidden = true;
  editorSection.hidden = false;
  route();
  loadMessages();
  return true;
}

$("login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = $("password").value;
  $("login-message").textContent = "";
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.ok) {
    $("password").value = "";
    await tryLoadEditor();
  } else if (res.status === 429) {
    $("login-message").textContent = "시도 횟수를 초과했습니다. 15분 후 다시 시도하세요.";
  } else {
    $("login-message").textContent = "비밀번호가 올바르지 않습니다.";
  }
});

tryLoadEditor();
