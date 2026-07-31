const loginSection = document.getElementById("login-section");
const editorSection = document.getElementById("editor-section");
const loginForm = document.getElementById("login-form");
const loginMessage = document.getElementById("login-message");
const saveBtn = document.getElementById("save-btn");
const addBtn = document.getElementById("add-btn");
const backupBtn = document.getElementById("backup-btn");
const logoutBtn = document.getElementById("logout-btn");
const saveMessage = document.getElementById("save-message");
const todoCount = document.getElementById("todo-count");
const formsRoot = document.getElementById("project-forms");

let projects = [];

function escapeAttr(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;",
  })[c]);
}

function approachToText(approach) {
  return Array.isArray(approach) ? approach.join("\n") : approach;
}

function textToApproach(text) {
  const lines = text.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.length <= 1 ? lines[0] || "" : lines;
}

// Only summary is nagged about: it is what the card displays, so a blank one is a visible hole.
// result is legitimately empty for projects nobody uses yet — silence there, not a warning.
function isIncomplete(p) {
  return !p.summary?.trim();
}

function projectFormHtml(p, i) {
  return `
    <details class="project-form${isIncomplete(p) ? " incomplete" : ""}" open>
      <summary>${escapeAttr(p.title)}${isIncomplete(p) ? " — ⚠ 한 줄 요약 미작성" : ""}</summary>
      <div class="form-toolbar">
        <button type="button" class="delete-btn" data-index="${i}">이 프로젝트 삭제</button>
      </div>
      <label>ID (스크린샷 폴더명과 동일해야 함 · 영문 소문자·숫자·하이픈)<input type="text" data-field="id" data-index="${i}" value="${escapeAttr(p.id)}"></label>
      <label>제목<input type="text" data-field="title" data-index="${i}" value="${escapeAttr(p.title)}"></label>
      <label>카테고리
        <select data-field="category" data-index="${i}">
          ${CATEGORIES.map((c) => `<option value="${escapeAttr(c)}" ${c === p.category ? "selected" : ""}>${escapeAttr(c)}</option>`).join("")}
        </select>
      </label>
      <label>진행 상태
        <select data-field="progress" data-index="${i}">
          <option value="in-progress" ${p.progress === "in-progress" ? "selected" : ""}>진행중</option>
          <option value="done" ${p.progress === "done" ? "selected" : ""}>완료</option>
        </select>
      </label>
      <label>공개 여부
        <select data-field="visibility" data-index="${i}">
          <option value="public" ${p.visibility === "public" ? "selected" : ""}>공개</option>
          <option value="private" ${p.visibility === "private" ? "selected" : ""}>비공개</option>
        </select>
      </label>
      <label>한 줄 요약 (60자 이내 · 카드에 표시됨)<input type="text" data-field="summary" maxlength="60" data-index="${i}" value="${escapeAttr(p.summary)}" placeholder="예) 9등급 시절 대입 결과를 5등급 학생과 같은 축으로 환산"></label>
      <label>문제 — 어떤 문제를 해결했는가<textarea data-field="problem" data-index="${i}" rows="3">${escapeAttr(p.problem)}</textarea></label>
      <label>접근 — 어떻게 만들었는가 (한 줄에 하나씩)<textarea data-field="approach" data-index="${i}" rows="4">${escapeAttr(approachToText(p.approach))}</textarea></label>
      <label>결과 — 실제로 쓰이고 있다는 근거 (선택 · 없으면 비워두세요)<textarea data-field="result" data-index="${i}" rows="3" placeholder="예) 3개 학년 부장이 학기마다 사용 중 / 작년 연수에서 40명이 실제로 돌려봄 / 성적처리 6시간→20분">${escapeAttr(p.result)}</textarea></label>
      <label>기술 태그 (쉼표로 구분)<input type="text" data-field="tags" data-index="${i}" value="${escapeAttr(p.tags.join(", "))}"></label>
      <label>GitHub 링크 (선택)<input type="text" data-field="repo" data-index="${i}" value="${escapeAttr(p.repo || "")}"></label>
      <label>제작 시기<input type="date" data-field="date" data-index="${i}" value="${escapeAttr(p.date)}"></label>
    </details>`;
}

function renderForms() {
  formsRoot.innerHTML = projects.map(projectFormHtml).join("");
  const todo = projects.filter(isIncomplete).length;
  todoCount.textContent = todo ? `한 줄 요약 미작성 ${todo}건 / ${projects.length}건` : `${projects.length}건 요약 작성 완료`;
  todoCount.classList.toggle("warn", todo > 0);
}

function collectProjects() {
  formsRoot.querySelectorAll("[data-field]").forEach((el) => {
    const i = Number(el.dataset.index);
    const field = el.dataset.field;
    if (field === "tags") {
      projects[i].tags = el.value.split(",").map((t) => t.trim()).filter(Boolean);
    } else if (field === "approach") {
      projects[i].approach = textToApproach(el.value);
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

function todayStr() {
  const d = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function newId() {
  let n = projects.length + 1;
  while (projects.some((p) => p.id === `new-project-${n}`)) n++;
  return `new-project-${n}`;
}

addBtn.addEventListener("click", () => {
  collectProjects(); // keep unsaved edits before re-rendering the list
  projects.push({
    id: newId(),
    title: "새 프로젝트",
    summary: "",
    category: CATEGORIES[0],
    tags: [],
    date: todayStr(),
    problem: "",
    approach: "",
    result: "",
    progress: "in-progress",
    visibility: "public",
  });
  renderForms();
  formsRoot.lastElementChild.scrollIntoView({ behavior: "smooth", block: "center" });
  saveMessage.textContent = "추가됨 — ID·제목·문제를 채우고 [전체 저장]을 누르세요.";
});

backupBtn.addEventListener("click", () => {
  const blob = new Blob([JSON.stringify(collectProjects(), null, 2)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `portfolio-backup-${todayStr()}.json`;
  a.click();
  URL.revokeObjectURL(a.href);
});

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

const messagesList = document.getElementById("messages-list");
const messagesCount = document.getElementById("messages-count");

function messageHtml(m) {
  const where = [m.region, m.country].filter(Boolean).join(" · ");
  return `
    <article class="message-item">
      <div class="message-head">
        <strong>${escapeAttr(m.name)}</strong>
        <span>${escapeAttr(m.contact)}</span>
        <span class="message-meta">${escapeAttr(m.at.slice(0, 16).replace("T", " "))}${where ? " · " + escapeAttr(where) : ""}</span>
        <button type="button" class="message-del" data-at="${escapeAttr(m.at)}">삭제</button>
      </div>
      <p>${escapeAttr(m.message)}</p>
    </article>`;
}

async function loadMessages() {
  const res = await fetch("/api/admin/messages");
  if (!res.ok) return;
  const items = await res.json();
  messagesCount.textContent = items.length ? `${items.length}건` : "없음";
  messagesList.innerHTML = items.length ? items.map(messageHtml).join("") : "<p>받은 문의가 없습니다.</p>";
}

messagesList.addEventListener("click", async (e) => {
  const btn = e.target.closest(".message-del");
  if (!btn) return;
  if (!confirm("이 문의를 삭제할까요?")) return;
  await fetch(`/api/admin/messages?at=${encodeURIComponent(btn.dataset.at)}`, { method: "DELETE" });
  loadMessages();
});

async function tryLoadEditor() {
  const res = await fetch("/api/admin/data");
  if (res.status === 401) return false;
  projects = await res.json();
  renderForms();
  loadMessages();
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
  if (res.ok) {
    saveMessage.textContent = "저장됨 — 사이트에 바로 반영됩니다.";
    return;
  }
  const err = await res.json().catch(() => ({}));
  if (err.error === "invalid_shape") {
    saveMessage.textContent = `${err.index + 1}번째 프로젝트의 필수 항목(ID·제목·문제·제작 시기)이 비어 있거나 형식이 잘못됐습니다.`;
  } else if (err.error === "duplicate_id") {
    saveMessage.textContent = `ID가 중복됩니다: ${err.id}`;
  } else {
    saveMessage.textContent = "저장 실패 — 다시 로그인해 보세요.";
  }
});

logoutBtn.addEventListener("click", async () => {
  await fetch("/api/logout", { method: "POST" });
  editorSection.hidden = true;
  loginSection.hidden = false;
});

tryLoadEditor();
