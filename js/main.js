const STATUS_LABEL = { "in-progress": "진행중", done: "완료" };
const VISIBILITY_LABEL = { public: "🌐 공개", private: "🔒 비공개" };

function methodHtml(method) {
  if (Array.isArray(method)) {
    return `<ul>${method.map((m) => `<li>${m}</li>`).join("")}</ul>`;
  }
  return `<p>${method}</p>`;
}

function screenshotHtml(p) {
  const src = SCREENSHOTS[p.id];
  if (src) {
    return `<img class="screenshot" src="${src}" alt="${p.title} 스크린샷">`;
  }
  return `<div class="screenshot-placeholder" data-project="${p.id}">스크린샷 준비 중</div>`;
}

function headerHtml(p) {
  return `
    <div class="card-header ${p.status}">
      <span class="status-pill">${STATUS_LABEL[p.status]}</span>
      <span class="visibility-pill">${VISIBILITY_LABEL[p.visibility]}</span>
      <h3>${p.title}</h3>
    </div>`;
}

function footerHtml(p) {
  return `
    <div class="card-footer">
      <div class="meta-group">
        ${p.repo ? `<a class="repo-link" href="${p.repo}" target="_blank" rel="noopener">🔗 GitHub</a>` : ""}
        <span class="meta-item">🕒 ${p.updated}</span>
      </div>
    </div>`;
}

function cardHtml(p) {
  return `
    <article class="card" data-id="${p.id}" tabindex="0" role="button" aria-haspopup="dialog">
      ${headerHtml(p)}
      <div class="card-body">
        ${screenshotHtml(p)}
        <div class="card-content">
          <h4>목적</h4>
          <p>${p.purpose}</p>
        </div>
        ${footerHtml(p)}
      </div>
    </article>`;
}

function renderCategories() {
  const root = document.getElementById("categories");
  root.innerHTML = CATEGORIES.map((cat) => {
    const items = PROJECTS.filter((p) => p.category === cat);
    return `
      <section class="category">
        <h2>${cat}</h2>
        <div class="card-grid">${items.map(cardHtml).join("")}</div>
      </section>`;
  }).join("");
}

function detailHtml(p) {
  return `
    ${headerHtml(p)}
    <div class="dialog-body">
      <h4>목적</h4>
      <p>${p.purpose}</p>
      <h4>방법</h4>
      ${methodHtml(p.method)}
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

renderCategories();
setupDialog();
