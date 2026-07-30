import { DEFAULT_PROJECTS } from "../_lib/default-projects.js";

export async function onRequestGet({ env }) {
  const raw = await env.PORTFOLIO_KV.get("projects");
  const data = raw ? JSON.parse(raw) : DEFAULT_PROJECTS;
  return new Response(JSON.stringify(data), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
