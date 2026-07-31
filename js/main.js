const PROGRESS_LABEL = { "in-progress": "진행중", done: "완료" };
const VISIBILITY_LABEL = { public: "🌐 공개", private: "🔒 비공개" };
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

function screenshotHtml(p) {
  const src = SCREENSHOTS[p.id];
  if (src) {
    return `<img class="screenshot" src="${src}" alt="${escapeHtml(p.title)} 스크린샷">`;
  }
  return `<div class="screenshot-placeholder" data-project="${escapeHtml(p.id)}">스크린샷 준비 중</div>`;
}

function headerHtml(p) {
  return `
    <div class="card-header ${p.progress}">
      <span class="status-pill">${PROGRESS_LABEL[p.progress]}</span>
      <span class="visibility-pill">${VISIBILITY_LABEL[p.visibility]}</span>
      <h3>${escapeHtml(p.title)}</h3>
    </div>`;
}

function footerHtml(p) {
  const href = safeRepoHref(p.repo);
  return `
    <div class="card-footer">
      <div class="meta-group">
        ${href ? `<a class="repo-link" href="${href}" target="_blank" rel="noopener">🔗 GitHub</a>` : ""}
        <span class="meta-item">🕒 ${escapeHtml(p.date)}</span>
      </div>
    </div>`;
}

function cardHtml(p) {
  return `
    <article class="card" data-id="${escapeHtml(p.id)}" tabindex="0" role="button" aria-haspopup="dialog">
      ${headerHtml(p)}
      <div class="card-body">
        ${screenshotHtml(p)}
        <div class="card-content">
          <p>${escapeHtml(p.summary || p.problem)}</p>
        </div>
        ${footerHtml(p)}
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
  tabs.innerHTML = labels
    .map((cat, i) => `<button class="tab${i === 0 ? " active" : ""}" data-category="${cat}">${cat}</button>`)
    .join("");

  tabs.addEventListener("click", (e) => {
    const btn = e.target.closest(".tab");
    if (!btn) return;
    tabs.querySelectorAll(".tab").forEach((t) => t.classList.toggle("active", t === btn));
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

function detailHtml(p) {
  return `
    ${headerHtml(p)}
    <div class="dialog-body">
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

  document.getElementById("categories").addEventListener("click", (e) => {
    if (e.target.closest(".repo-link")) return;
    const card = e.target.closest(".card");
    if (!card) return;
    openProject(card.dataset.id, true);
  });

  document.getElementById("categories").addEventListener("keydown", (e) => {
    if (e.key !== "Enter" && e.key !== " ") return;
    if (e.target.classList.contains("card")) {
      e.preventDefault();
      e.target.click();
    }
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
}

// 숫자는 전부 데이터에서 계산한다 — 손으로 적어두면 항목을 늘렸을 때 조용히 거짓말이 된다.
function renderStats() {
  const done = PROJECTS.filter((p) => p.progress === "done").length;
  const latest = PROJECTS[0] ? PROJECTS[0].date.slice(5).replace("-", ".") : "-";
  const cells = [
    ["산출물", PROJECTS.length],
    ["완료", done],
    ["진행중", PROJECTS.length - done],
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
        setTimeout(() => dialog.close(), 1500);
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
