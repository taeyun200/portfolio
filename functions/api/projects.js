import { loadProjects } from "../_lib/projects.js";

export async function onRequestGet({ env }) {
  return new Response(JSON.stringify(await loadProjects(env)), {
    headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
  });
}
