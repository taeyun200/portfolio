import { DEFAULT_PROJECTS } from "./default-projects.js";

const DOT_DATE = /^(\d{4})\.(\d{2})\.(\d{2})$/;

// KV still holds v1 records (purpose/method/status/updated) written before the schema change.
// Upgrading on read means no manual KV surgery: the first save through /edit rewrites v2 in place.
export function normalize(p) {
  const out = {
    id: p.id,
    title: p.title,
    summary: p.summary || "",
    category: p.category,
    tags: Array.isArray(p.tags) ? p.tags : [],
    date: p.date || String(p.updated || "").replace(DOT_DATE, "$1-$2-$3"),
    problem: p.problem ?? p.purpose ?? "",
    approach: p.approach ?? p.method ?? "",
    result: p.result || "",
    progress: p.progress || p.status || "in-progress",
    visibility: p.visibility || "public",
  };
  if (p.repo) out.repo = p.repo;
  if (p.site) out.site = p.site;
  // 타임라인 칸 자리. 없으면 date 를 쓴다.
  if (p.start) out.start = p.start;
  // 대표작: 첫 화면 위쪽에 크게 놓는 순서(1~)와 카드 아래 한 줄.
  if (p.feature) out.feature = p.feature;
  if (p.featureNote) out.featureNote = p.featureNote;
  // 스크린샷을 카드 칸에 맞춰 자를 때 어디를 남길지. 기본(가운데)이면 아예 두지 않는다.
  if (p.shot) out.shot = p.shot;
  return out;
}

export async function loadProjects(env) {
  const raw = await env.PORTFOLIO_KV.get("projects");
  const list = raw ? JSON.parse(raw) : DEFAULT_PROJECTS;
  return list.map(normalize);
}
