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
  return out;
}

export async function loadProjects(env) {
  const raw = await env.PORTFOLIO_KV.get("projects");
  const list = raw ? JSON.parse(raw) : DEFAULT_PROJECTS;
  return list.map(normalize);
}
