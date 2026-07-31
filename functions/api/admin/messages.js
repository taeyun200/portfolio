import { verifySessionToken, getCookie } from "../../_lib/session.js";

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

async function requireSession(request, env) {
  const token = getCookie(request, "session");
  return verifySessionToken(env.SESSION_SECRET, token);
}

export async function onRequestGet({ request, env }) {
  if (!(await requireSession(request, env))) return json({ ok: false }, 401);

  const list = await env.PORTFOLIO_KV.list({ prefix: "contact:msg:" });
  const items = await Promise.all(
    list.keys.map(async (k) => JSON.parse((await env.PORTFOLIO_KV.get(k.name)) || "null"))
  );
  // 키가 ISO 시각이라 사전순 정렬이 곧 시간순 — 최신이 위로.
  return json(items.filter(Boolean).reverse(), 200);
}

export async function onRequestDelete({ request, env }) {
  if (!(await requireSession(request, env))) return json({ ok: false }, 401);

  const at = new URL(request.url).searchParams.get("at");
  if (!at) return json({ ok: false, error: "bad_request" }, 400);
  await env.PORTFOLIO_KV.delete(`contact:msg:${at}`);
  return json({ ok: true }, 200);
}
