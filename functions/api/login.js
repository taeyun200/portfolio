import { createSessionToken, sessionCookie, SESSION_TTL_SECONDS } from "../_lib/session.js";
import { isLocked, recordFailure, clearFailures } from "../_lib/rateLimit.js";

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

export async function onRequestPost({ request, env }) {
  const kv = env.PORTFOLIO_KV;

  if (await isLocked(kv)) {
    return json({ ok: false, error: "too_many_attempts" }, 429);
  }

  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  if (body.password !== env.ADMIN_PASSWORD) {
    await recordFailure(kv);
    return json({ ok: false, error: "invalid_password" }, 401);
  }

  await clearFailures(kv);
  const token = await createSessionToken(env.SESSION_SECRET);
  const res = json({ ok: true }, 200);
  res.headers.append("Set-Cookie", sessionCookie(token, SESSION_TTL_SECONDS));
  return res;
}
