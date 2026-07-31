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

function filterByCategory(cat) {
  document.querySelectorAll("#categories .category").forEach((section) => {
    section.hidden = cat !== "전체" && section.dataset.category !== cat;
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
    filterByCategory(btn.dataset.category);
  });
}

function detailHtml(p) {
  return `
    ${headerHtml(p)}
    <div class="dialog-body">
      <h4>문제</h4>
      <p>${escapeHtml(p.problem)}</p>
      <h4>접근</h4>
      ${approachHtml(p.approach)}
      ${p.result ? `<h4>결과</h4><p class="result">${escapeHtml(p.result)}</p>` : ""}
      ${footerHtml(p)}
    </div>`;
}

function setupDialog() {
  const dialog = document.getElementById("detail-dialog");
  const content = document.getElementById("detail-content");
  const closeBtn = dialog.querySelector(".dialog-close");

  document.getElementById("categories").addEventListener("click", (e) => {
    if (e.target.closest(".repo-link")) return;
    const card = e.target.closest(".card");
    if (!card) return;
    const project = PROJECTS.find((p) => p.id === card.dataset.id);
    content.innerHTML = detailHtml(project);
    dialog.showModal();
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
  renderCategories();
  renderTabs();
  setupDialog();
}

init();
