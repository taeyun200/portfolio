import { sessionCookie } from "../_lib/session.js";

export async function onRequestPost() {
  const res = new Response(JSON.stringify({ ok: true }), {
    status: 200,
    headers: { "Content-Type": "application/json" },
  });
  res.headers.append("Set-Cookie", sessionCookie("", 0));
  return res;
}
