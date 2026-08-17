const PROGRESS_LABEL = { "in-progress": "진행중", done: "완료" };
const VISIBILITY_LABEL = { public: "공개", private: "비공개" };
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

// 이모지는 OS마다 모양·크기가 달라 통일된 인상을 못 만들고 글자색을 따라오지 않는다.
// 획 굵기 1.5 로 맞춘 한 벌만 두고 색은 currentColor 로 받는다.
const ICON = {
  lock: `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><rect x="3.2" y="7" width="9.6" height="6.6" rx="1.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M5.6 7V5.2a2.4 2.4 0 0 1 4.8 0V7" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
  globe: `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><circle cx="8" cy="8" r="5.6" fill="none" stroke="currentColor" stroke-width="1.5"/><path d="M2.4 8h11.2M8 2.4c1.5 1.6 2.2 3.5 2.2 5.6S9.5 12 8 13.6C6.5 12 5.8 10.1 5.8 8S6.5 4 8 2.4Z" fill="none" stroke="currentColor" stroke-width="1.5"/></svg>`,
  repo: `<svg class="ico" viewBox="0 0 16 16" aria-hidden="true"><path d="M6.6 12.4c-2.8.9-2.8-1.4-4-1.7m8 3.3v-2.2c0-.6-.1-1 .3-1.4 1.8-.2 3.5-.9 3.5-3.9a3 3 0 0 0-.8-2.1 2.8 2.8 0 0 0-.1-2.1s-.7-.2-2.3.9a7.8 7.8 0 0 0-4 0C5.6 2.1 4.9 2.3 4.9 2.3a2.8 2.8 0 0 0-.1 2.1 3 3 0 0 0-.8 2.1c0 3 1.7 3.7 3.5 3.9-.3.3-.4.7-.3 1.1v2.5" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
};

// SCREENSHOTS 는 프로젝트당 배열이다. 첫 장이 카드 겉면, 전부가 모달에 실린다.
// 예전 형식(문자열 하나)도 그대로 읽히도록 감싸 준다.
function shotsOf(p) {
  const v = SCREENSHOTS[p.id];
  return !v ? [] : Array.isArray(v) ? v : [v];
}

function screenshotHtml(p) {
  const src = shotsOf(p)[0];
  if (src) {
    const shot = ["top", "bottom", "fit"].includes(p.shot) ? ` shot-${p.shot}` : "";
    return `<img class="screenshot${shot}" src="${src}" alt="${escapeHtml(p.title)} 스크린샷">`;
  }
  return `<div class="screenshot-placeholder" data-project="${escapeHtml(p.id)}">스크린샷 준비 중</div>`;
}

// 상태를 색면이 아니라 칩으로 옮긴다. 점 + 글자라 색을 못 봐도 읽히고,
// 오렌지를 상태에서 빼내 '누를 수 있는 것' 한 뜻만 지게 한다.
function chipsHtml(p) {
  const vis = p.visibility === "private" ? ICON.lock : ICON.globe;
  return `
    <div class="chips">
      <span class="chip chip-${p.progress}"><span class="dot"></span>${PROGRESS_LABEL[p.progress]}</span>
      <span class="chip">${vis}${VISIBILITY_LABEL[p.visibility]}</span>
    </div>`;
}

// trailing 은 카드에서만 쓰는 '자세히 보기' 힌트 — 모달에서는 뜻이 없어 비워 둔다.
function footerHtml(p, trailing = "") {
  const href = safeRepoHref(p.repo);
  return `
    <div class="card-footer">
      <div class="meta-group">
        ${href ? `<a class="repo-link" href="${href}" target="_blank" rel="noopener">${ICON.repo}GitHub</a>` : ""}
        <span class="meta-item">${escapeHtml(p.date)}</span>
      </div>
      ${trailing}
    </div>`;
}

// 카드 전체를 role="button" 으로 두면 안의 GitHub 링크가 버튼 속에 갇히고,
// 제목이 버튼 이름에 흡수돼 제목 목록에서 사라진다. 제목만 진짜 버튼으로 만들고
// 카드 전체 클릭은 편의로 남긴다 — 스크린샷이 맨 위로 올라와 카드의 얼굴이 된다.
function cardHtml(p) {
  return `
    <article class="card" data-id="${escapeHtml(p.id)}">
      <div class="card-shot">${screenshotHtml(p)}</div>
      <div class="card-body">
        ${chipsHtml(p)}
        <h3 class="card-title">
          <button class="card-open" type="button" aria-haspopup="dialog">${escapeHtml(p.title)}</button>
        </h3>
        <p class="card-summary">${escapeHtml(p.summary || p.problem)}</p>
        ${footerHtml(p, `<span class="more" aria-hidden="true">자세히 보기 →</span>`)}
      </div>
    </article>`;
}

function activeCategories() {
  return CATEGORIES.filter((cat) => PROJECTS.some((p) => p.category === cat));
}

function renderCategories() {
  const root = document.getElementById("categories");
  root.innerHTML = activeCategories()
    .map((cat) => {
      const items = PROJECTS.filter((p) => p.category === cat);
      return `
      <section class="category" data-category="${cat}">
        <h2>${cat}</h2>
        <div class="card-grid">${items.map(cardHtml).join("")}</div>
      </section>`;
    })
    .join("");
}

let activeCategory = "전체";

function applyFilters() {
  document.querySelectorAll("#categories .category").forEach((section) => {
    section.hidden = activeCategory !== "전체" && section.dataset.category !== activeCategory;
  });
}

function renderTabs() {
  const tabs = document.getElementById("tabs");
  const labels = ["전체", ...activeCategories()];
  // 선택 상태를 .active 클래스(=색)에만 싣지 않는다. aria-pressed 로 눌린 상태를 함께 알린다.
  tabs.innerHTML = labels
    .map(
      (cat, i) =>
        `<button class="tab${i === 0 ? " active" : ""}" type="button" aria-pressed="${i === 0}" data-category="${cat}">${cat}</button>`
    )
    .join("");

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    tabs.querySelectorAll(".tab").forEach((t) => {
      const on = t === btn;
      t.classList.toggle("active", on);
      t.setAttribute("aria-pressed", String(on));
    });
    activeCategory = btn.dataset.category;
    applyFilters();
  });
}

// 도식은 있으면 쓰고 없으면 만다. 목록 파일을 두지 않아, 그림을 추가할 때 파일만 넣으면 된다.
// 주의: Pages 는 없는 파일에 404 가 아니라 index.html(200) 을 돌려준다. 그래도 <img> 가
// HTML 을 이미지로 디코딩하지 못해 error 가 나므로 아래 onerror 로 잡힌다.
function diagramHtml(p) {
  // 제목까지 함께 지워야 하므로 바깥 블록을 통째로 제거한다.
  return `
    <div class="diagram-block">
      <h4>구조</h4>
      <figure class="diagram">
        <img src="assets/diagrams/${escapeHtml(p.id)}.svg" alt="${escapeHtml(p.title)} 구조 도식"
             onerror="this.closest('.diagram-block').remove()">
      </figure>
    </div>`;
}

// 겉면의 124px 칸에서는 잘려 보인다. 열었을 때는 잘림 없이 전체를 보여주고,
// 누르면 원본 크기로 띄운다. 도식과 같은 .diagram 밴드를 그대로 쓴다.
function shotHtml(p) {
  const list = shotsOf(p);
  if (!list.length) return "";
  const figures = list
    .map((src, i) => {
      const label = `${escapeHtml(p.title)} 스크린샷${list.length > 1 ? ` ${i + 1}` : ""}`;
      return `
      <figure class="diagram shot-zoom">
        <img src="${src}" alt="${label}" tabindex="0" role="button"
             aria-label="${label} — 눌러서 크게 보기">
      </figure>`;
    })
    .join("");
  return `<h4>화면${list.length > 1 ? ` <span class="count">${list.length}장</span>` : ""}</h4>${figures}`;
}

function detailHtml(p) {
  return `
    <div class="dialog-head">
      ${chipsHtml(p)}
      <h3 id="detail-title">${escapeHtml(p.title)}</h3>
    </div>
    <div class="dialog-body">
      ${shotHtml(p)}
      <h4>문제</h4>
      <p>${escapeHtml(p.problem)}</p>
      <h4>접근</h4>
      ${approachHtml(p.approach)}
      ${diagramHtml(p)}
      ${p.result ? `<h4>결과</h4><p class="result">${escapeHtml(p.result)}</p>` : ""}
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
  if (push) history.pushState({ id }, "", `#${id}`);
}

function setupDialog() {
  const dialog = document.getElementById("detail-dialog");
  const closeBtn = dialog.querySelector(".dialog-close");

  // 제목 버튼의 Enter·Space 도 click 으로 올라오므로 별도의 keydown 처리가 필요 없다.
  document.getElementById("categories").addEventListener("click", (e) => {
    if (e.target.closest(".repo-link")) return;
    const card = e.target.closest(".card");
    if (!card) return;
    openProject(card.dataset.id, true);
  });

  closeBtn.addEventListener("click", () => dialog.close());
  dialog.addEventListener("click", (e) => {
    if (e.target === dialog) dialog.close();
  });

  // Covers the ✕, the backdrop, and Esc in one place.
  dialog.addEventListener("close", () => {
    if (location.hash) history.pushState(null, "", location.pathname);
  });

  window.addEventListener("popstate", () => {
    const id = location.hash.slice(1);
    if (id) openProject(id, false);
    else if (dialog.open) dialog.close();
  });

  setupShotZoom();
}

// 원본 보기는 <dialog> 하나로 끝난다 — Esc·포커스 복귀·바깥 클릭을 브라우저가 맡는다.
// 상세 모달 위에 겹쳐 뜨며(top layer), 닫혀도 상세 모달은 그대로 남는다.
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

  // 그림 자체가 아닌 곳(바깥 여백·✕)을 누르면 닫는다 — 닫기 버튼도 이 한 줄이 겸한다.
  shotDialog.addEventListener("click", (e) => {
    if (e.target !== big) shotDialog.close();
  });
}

// 숫자는 전부 데이터에서 계산한다 — 손으로 적어두면 항목을 늘렸을 때 조용히 거짓말이 된다.
function renderStats() {
  const done = PROJECTS.filter((p) => p.progress === "done").length;
  const latest = PROJECTS[0] ? PROJECTS[0].date.slice(5).replace("-", ".") : "-";
  // '진행중 N' 은 포트폴리오 첫 화면에서 굳이 세어 내놓을 숫자가 아니다 — 아직 안 끝난 것이
  // 몇 개인지보다, 다루는 분야가 몇 갈래인지가 훑는 사람에게 쓸모 있다.
  const cells = [
    ["산출물", PROJECTS.length],
    ["완료", done],
    ["분야", activeCategories().length],
    ["최근 갱신", latest],
  ];
  document.getElementById("stats").innerHTML = cells
    .map(([label, value]) => `<div class="stat"><strong>${escapeHtml(String(value))}</strong><span>${label}</span></div>`)
    .join("");
}

// .reveal 을 JS로만 붙인다. 스크립트가 죽거나 IntersectionObserver 가 없으면
// 클래스가 안 붙어 카드는 그냥 보인다 — 애니메이션 때문에 내용이 사라지는 일은 없다.
function setupReveal() {
  if (!("IntersectionObserver" in window)) return;
  if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;

  const io = new IntersectionObserver(
    (entries) => {
      entries
        .filter((e) => e.isIntersecting)
        .forEach((e, i) => {
          e.target.style.transitionDelay = `${i * 50}ms`;
          e.target.classList.add("in");
          io.unobserve(e.target);
        });
    },
    { rootMargin: "0px 0px -40px 0px" }
  );

  document.querySelectorAll("#categories .card").forEach((card) => {
    card.classList.add("reveal");
    io.observe(card);
  });
}

function setupContact() {
  const dialog = document.getElementById("contact-dialog");
  const form = document.getElementById("contact-form");
  const msg = document.getElementById("contact-msg");
  const sendBtn = document.getElementById("contact-send");

  document.getElementById("contact-btn").addEventListener("click", () => {
    msg.textContent = "";
    form.reset();
    dialog.showModal();
  });
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
  const root = document.getElementById("categories");
  try {
    const res = await fetch("/api/projects");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    PROJECTS = await res.json();
  } catch (err) {
    root.textContent = "프로젝트 정보를 불러오지 못했습니다. 잠시 후 새로고침해 주세요.";
    return;
  }
  // 완료된 것을 먼저, 그 안에서 최신순. 완료·진행중이 섞이면 목록이 어수선해 보인다.
  // ISO dates sort correctly as plain strings — that is why the schema uses them.
  const rank = (p) => (p.progress === "done" ? 0 : 1);
  PROJECTS.sort((a, b) => rank(a) - rank(b) || b.date.localeCompare(a.date));
  renderStats();
  renderCategories();
  renderTabs();
  setupReveal();
  setupDialog();
  setupContact();
  // Shared link like /#hapbul lands straight on that project.
  if (location.hash) openProject(location.hash.slice(1), false);
}

init();
