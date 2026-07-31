import { verifySessionToken, getCookie } from "../../_lib/session.js";
import { loadProjects } from "../../_lib/projects.js";

export async function onRequestGet({ request, env }) {
  const token = getCookie(request, "session");
  if (!(await verifySessionToken(env.SESSION_SECRET, token))) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify(await loadProjects(env)), {
    headers: { "Content-Type": "application/json" },
  });
}
