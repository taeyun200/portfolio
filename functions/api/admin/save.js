import { verifySessionToken, getCookie } from "../../_lib/session.js";

const REQUIRED_FIELDS = [
  "id", "title", "summary", "category", "tags", "date",
  "problem", "approach", "result", "progress", "visibility",
];

function nonEmptyString(v) {
  return typeof v === "string" && v.trim() !== "";
}

export function isValidProject(p) {
  if (typeof p !== "object" || p === null) return false;
  for (const field of REQUIRED_FIELDS) {
    if (!(field in p)) return false;
  }
  // id doubles as the screenshot folder name and the card lookup key — keep it a strict slug.
  if (!nonEmptyString(p.id) || !/^[a-z0-9-]+$/.test(p.id)) return false;
  if (!nonEmptyString(p.title)) return false;
  if (!nonEmptyString(p.problem)) return false;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(p.date)) return false;
  if (!Array.isArray(p.tags)) return false;
  if (typeof p.approach !== "string" && !Array.isArray(p.approach)) return false;
  // ponytail: summary/result must exist but may be blank while the 7 seed entries are backfilled.
  // Tighten to nonEmptyString once every project has both (PRD §6-3).
  if (typeof p.summary !== "string" || typeof p.result !== "string") return false;
  return true;
}

// Duplicate ids silently break the detail dialog (find() returns the first match), so reject them.
export function findDuplicateId(list) {
  const seen = new Set();
  for (const p of list) {
    if (seen.has(p.id)) return p.id;
    seen.add(p.id);
  }
  return null;
}

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

export async function onRequestPost({ request, env }) {
  const token = getCookie(request, "session");
  if (!(await verifySessionToken(env.SESSION_SECRET, token))) {
    return json({ ok: false }, 401);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  if (!Array.isArray(body) || body.length === 0) {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  const badIndex = body.findIndex((p) => !isValidProject(p));
  if (badIndex !== -1) {
    return json({ ok: false, error: "invalid_shape", index: badIndex }, 400);
  }

  const dupId = findDuplicateId(body);
  if (dupId) {
    return json({ ok: false, error: "duplicate_id", id: dupId }, 400);
  }

  await env.PORTFOLIO_KV.put("projects", JSON.stringify(body));
  return json({ ok: true }, 200);
}
