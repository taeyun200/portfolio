// 방문자가 남긴 문의를 KV에 보관한다. 메일 발송은 하지 않는다 —
// 외부 메일 API를 붙이면 키 관리와 만료가 따라붙고, "6개월 방치해도 안 깨진다"는
// 이 사이트의 전제를 깬다. 보관된 문의는 /edit 에서 확인한다.
const MAX = { name: 40, contact: 120, message: 2000 };
const WINDOW_SECONDS = 60 * 60;
const MAX_PER_WINDOW = 5;

function json(obj, status) {
  return new Response(JSON.stringify(obj), { status, headers: { "Content-Type": "application/json" } });
}

function clean(v, limit) {
  return typeof v === "string" ? v.trim().slice(0, limit) : "";
}

export async function onRequestPost({ request, env }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return json({ ok: false, error: "bad_request" }, 400);
  }

  // 봇은 사람에게 보이지 않는 칸도 채운다. 채워져 있으면 조용히 성공으로 응답해
  // 실패를 학습하지 못하게 한다.
  if (clean(body.website, 10)) return json({ ok: true }, 200);

  const name = clean(body.name, MAX.name);
  const contact = clean(body.contact, MAX.contact);
  const message = clean(body.message, MAX.message);
  if (!name || !contact || !message) return json({ ok: false, error: "missing_field" }, 400);

  // IP당 시간당 5건. 한 사람이 폼을 반복 제출해 KV를 채우는 것을 막는다.
  const ip = request.headers.get("CF-Connecting-IP") || "unknown";
  const rateKey = `contact:rate:${ip}`;
  const count = Number((await env.PORTFOLIO_KV.get(rateKey)) || 0);
  if (count >= MAX_PER_WINDOW) return json({ ok: false, error: "too_many" }, 429);
  await env.PORTFOLIO_KV.put(rateKey, String(count + 1), { expirationTtl: WINDOW_SECONDS });

  const at = new Date().toISOString();
  await env.PORTFOLIO_KV.put(
    `contact:msg:${at}`,
    JSON.stringify({ at, name, contact, message, region: request.cf?.region || "", country: request.cf?.country || "" })
  );

  return json({ ok: true }, 200);
}
