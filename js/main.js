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

function tagsHtml(p) {
  if (!p.tags.length) return "";
  const chips = p.tags.map((t) => `<button class="tag" data-tag="${escapeHtml(t)}">${escapeHtml(t)}</button>`);
  return `<div class="tag-row">${chips.join("")}</div>`;
}

function cardHtml(p) {
  return `
    <article class="card" data-id="${escapeHtml(p.id)}" tabindex="0" role="button" aria-haspopup="dialog">
      ${headerHtml(p)}
      <div class="card-body">
        ${screenshotHtml(p)}
        <div class="card-content">
          <p>${escapeHtml(p.summary || p.problem)}</p>
          ${tagsHtml(p)}
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
let activeTag = null;

// Category and tag stack: a section hides when the category excludes it, or when the tag
// filter emptied every card inside it (otherwise you get a heading over nothing).
function applyFilters() {
  document.querySelectorAll("#categories .category").forEach((section) => {
    const cards = [...section.querySelectorAll(".card")];
    cards.forEach((card) => {
      const p = PROJECTS.find((x) => x.id === card.dataset.id);
      card.hidden = !!activeTag && !p.tags.includes(activeTag);
    });
    const catMatch = activeCategory === "전체" || section.dataset.category === activeCategory;
    section.hidden = !catMatch || cards.every((c) => c.hidden);
  });

  const bar = document.getElementById("active-filter");
  bar.innerHTML = activeTag
    ? `<span>태그 <strong>${escapeHtml(activeTag)}</strong> 로 좁힘</span><button id="clear-tag">✕ 해제</button>`
    : "";
  bar.hidden = !activeTag;

  document.querySelectorAll("#categories .tag").forEach((chip) => {
    chip.classList.toggle("active", chip.dataset.tag === activeTag);
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

function setupTagFilter() {
  document.getElementById("categories").addEventListener("click", (e) => {
    const chip = e.target.closest(".tag");
    if (!chip) return;
    activeTag = chip.dataset.tag === activeTag ? null : chip.dataset.tag;
    applyFilters();
  });

  document.getElementById("active-filter").addEventListener("click", (e) => {
    if (!e.target.closest("#clear-tag")) return;
    activeTag = null;
    applyFilters();
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
    if (e.target.closest(".repo-link") || e.target.closest(".tag")) return;
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
  // ISO dates sort correctly as plain strings — that is why the schema uses them.
  PROJECTS.sort((a, b) => b.date.localeCompare(a.date));
  renderCategories();
  renderTabs();
  setupTagFilter();
  setupDialog();
  // Shared link like /#hapbul lands straight on that project.
  if (location.hash) openProject(location.hash.slice(1), false);
}

init();
