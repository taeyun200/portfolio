import { verifySessionToken, getCookie } from "../../_lib/session.js";
import { DEFAULT_PROJECTS } from "../../_lib/default-projects.js";

export async function onRequestGet({ request, env }) {
  const token = getCookie(request, "session");
  if (!(await verifySessionToken(env.SESSION_SECRET, token))) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  const raw = await env.PORTFOLIO_KV.get("projects");
  const data = raw ? JSON.parse(raw) : DEFAULT_PROJECTS;
  return new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
}
