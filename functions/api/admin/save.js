import { verifySessionToken, getCookie } from "../../_lib/session.js";

const REQUIRED_FIELDS = ["id", "title", "category", "status", "visibility", "purpose", "method", "tags", "updated"];

function isValidProject(p) {
  if (typeof p !== "object" || p === null) return false;
  for (const field of REQUIRED_FIELDS) {
    if (!(field in p)) return false;
  }
  if (typeof p.purpose !== "string" || !p.purpose.trim()) return false;
  if (!Array.isArray(p.tags)) return false;
  const methodOk = typeof p.method === "string" || Array.isArray(p.method);
  if (!methodOk) return false;
  return true;
}

export async function onRequestPost({ request, env }) {
  const token = getCookie(request, "session");
  if (!(await verifySessionToken(env.SESSION_SECRET, token))) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ ok: false, error: "bad_request" }), { status: 400 });
  }

  if (!Array.isArray(body) || body.length === 0 || !body.every(isValidProject)) {
    return new Response(JSON.stringify({ ok: false, error: "invalid_shape" }), { status: 400 });
  }

  await env.PORTFOLIO_KV.put("projects", JSON.stringify(body));
  return new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
}
