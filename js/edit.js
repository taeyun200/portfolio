const loginSection = document.getElementById("login-section");
const editorSection = document.getElementById("editor-section");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const saveBtn = document.getElementById("save-btn");
const logoutBtn = document.getElementById("logout-btn");
const saveMessage = document.getElementById("save-message");
const formsRoot = document.getElementById("project-forms");

let projects = [];

function escapeAttr(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function methodToText(method) {
  return Array.isArray(method) ? method.join("\n") : method;
}

function textToMethod(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length <= 1 ? lines[0] || "" : lines;
}

function projectFormHtml(p, i) {
  return `
    <details class="project-form" open>
      <summary>${escapeAttr(p.title)}</summary>
      <div class="form-toolbar">
        <button type="button" class="delete-btn" data-index="${i}">이 프로젝트 삭제</button>
      </div>
      <label>제목<input type="text" data-field="title" data-index="${i}" value="${escapeAttr(p.title)}"></label>
      <label>카테고리
        <select data-field="category" data-index="${i}">
          ${CATEGORIES.map((c) => `<option value="${escapeAttr(c)}" ${c === p.category ? "selected" : ""}>${escapeAttr(c)}</option>`).join("")}
        </select>
      </label>
      <label>상태
        <select data-field="status" data-index="${i}">
          <option value="in-progress" ${p.status === "in-progress" ? "selected" : ""}>진행중</option>
          <option value="done" ${p.status === "done" ? "selected" : ""}>완료</option>
        </select>
      </label>
      <label>공개 여부
        <select data-field="visibility" data-index="${i}">
          <option value="public" ${p.visibility === "public" ? "selected" : ""}>공개</option>
          <option value="private" ${p.visibility === "private" ? "selected" : ""}>비공개</option>
        </select>
      </label>
      <label>목적<textarea data-field="purpose" data-index="${i}" rows="2">${escapeAttr(p.purpose)}</textarea></label>
      <label>방법 (한 줄에 하나씩)<textarea data-field="method" data-index="${i}" rows="4">${escapeAttr(methodToText(p.method))}</textarea></label>
      <label>기술 태그 (쉼표로 구분)<input type="text" data-field="tags" data-index="${i}" value="${escapeAttr(p.tags.join(", "))}"></label>
      <label>GitHub 링크 (선택)<input type="text" data-field="repo" data-index="${i}" value="${escapeAttr(p.repo || "")}"></label>
      <label>최근 업데이트<input type="text" data-field="updated" data-index="${i}" value="${escapeAttr(p.updated)}"></label>
    </details>`;
}

function renderForms() {
  formsRoot.innerHTML = projects.map(projectFormHtml).join("");
}

function collectProjects() {
  formsRoot.querySelectorAll("[data-field]").forEach((el) => {
    const i = Number(el.dataset.index);
    const field = el.dataset.field;
    if (field === "tags") {
      projects[i].tags = el.value.split(",").map((t) => t.trim()).filter(Boolean);
    } else if (field === "method") {
      projects[i].method = textToMethod(el.value);
    } else if (field === "repo") {
      const v = el.value.trim();
      if (v) projects[i].repo = v;
      else delete projects[i].repo;
    } else {
      projects[i][field] = el.value;
    }
  });
  return projects;
}

formsRoot.addEventListener("click", (e) => {
  const btn = e.target.closest(".delete-btn");
  if (!btn) return;
  const i = Number(btn.dataset.index);
  collectProjects(); // keep any unsaved edits in other forms before restructuring
  const title = projects[i].title;
  if (!confirm(`"${title}" 프로젝트를 목록에서 삭제할까요?\n(전체 저장을 눌러야 실제로 반영됩니다)`)) return;
  projects.splice(i, 1);
  renderForms();
});

async function tryLoadEditor() {
  const res = await fetch("/api/admin/data");
  if (res.status === 401) return false;
  projects = await res.json();
  renderForms();
  loginSection.hidden = true;
  editorSection.hidden = false;
  return true;
}

loginForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const password = document.getElementById("password").value;
  loginMessage.textContent = "";
  const res = await fetch("/api/login", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ password }),
  });
  if (res.ok) {
    await tryLoadEditor();
  } else if (res.status === 429) {
    loginMessage.textContent = "시도 횟수를 초과했습니다. 15분 후 다시 시도하세요.";
  } else {
    loginMessage.textContent = "비밀번호가 올바르지 않습니다.";
  }
});

saveBtn.addEventListener("click", async () => {
  saveMessage.textContent = "저장 중...";
  const body = collectProjects();
  const res = await fetch("/api/admin/save", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  saveMessage.textContent = res.ok ? "저장됨 — 사이트에 바로 반영됩니다." : "저장 실패 — 다시 로그인해 보세요.";
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  editorSection.hidden = true;
  loginSection.hidden = false;
});

tryLoadEditor();
