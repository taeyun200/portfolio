const MAX_FAILS = 5;
const WINDOW_SECONDS = 15 * 60;
const KV_KEY = "login:lock";

export async function isLocked(kv) {
  const raw = await kv.get(KV_KEY);
  if (!raw) return false;
  const { count, first } = JSON.parse(raw);
  const age = Date.now() / 1000 - first;
  if (age > WINDOW_SECONDS) return false;
  return count >= MAX_FAILS;
}

export async function recordFailure(kv) {
  const raw = await kv.get(KV_KEY);
  const now = Date.now() / 1000;
  let state = raw ? JSON.parse(raw) : { count: 0, first: now };
  if (now - state.first > WINDOW_SECONDS) state = { count: 0, first: now };
  state.count += 1;
  await kv.put(KV_KEY, JSON.stringify(state), { expirationTtl: WINDOW_SECONDS });
}

export async function clearFailures(kv) {
  await kv.delete(KV_KEY);
}
