// 프로젝트 하나를 올리거나(새 ID) 고친다(있는 ID). 전역 스킬 portfolio-upload 가 부른다.
//
//   node scripts/upsert-project.mjs <project.json>             무엇이 바뀌는지만 보여 준다
//   node scripts/upsert-project.mjs <project.json> --preview   예비본(default-projects.js)에 써서 로컬 미리보기
//   node scripts/upsert-project.mjs <project.json> --publish   라이브 데이터(KV)에 쓴다
//
// <project.json> 은 프로젝트 하나. 고칠 때는 바꿀 칸만 넣어도 되고, 값을 null 로 주면 그 칸을 지운다.
// 어느 쪽이든 먼저 라이브 데이터를 저장소 밖(~/.cache/portfolio/backups/)에 백업한다.
// --publish 는 영상·스크린샷·도식이 라이브 사이트에 실제로 올라가 있는지 먼저 확인한다 —
// 배포 전에 데이터만 바뀌면 카드에 깨진 그림이 뜬다. 확인을 건너뛰려면 --force.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { isValidProject, findDuplicateId } from "../functions/api/admin/save.js";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SITE = "https://taeyun-portfolio.pages.dev";
const SEED = path.join(ROOT, "functions", "_lib", "default-projects.js");
const BACKUPS = path.join(os.homedir(), ".cache", "portfolio", "backups");

const args = process.argv.slice(2);
const file = args.find((a) => !a.startsWith("--"));
const mode = args.includes("--publish") ? "publish" : args.includes("--preview") ? "preview" : "check";
const force = args.includes("--force");
if (!file) {
  console.error("사용법: node scripts/upsert-project.mjs <project.json> [--preview | --publish] [--force]");
  process.exit(2);
}

// wrangler.jsonc 에서 KV 네임스페이스 ID — 한 곳에서만 관리한다
const conf = fs.readFileSync(path.join(ROOT, "wrangler.jsonc"), "utf8").replace(/\/\/.*$/gm, "");
const NS = JSON.parse(conf).kv_namespaces.find((k) => k.binding === "PORTFOLIO_KV").id;
// Cloudflare 로그인(OAuth)은 가끔 만료돼 401 이 난다. 한 번은 다시 시도한다 — 대개 그 사이 갱신된다.
function wrangler(cmd) {
  const run = () =>
    execSync(`npx wrangler kv key ${cmd} --namespace-id ${NS} --remote`, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"], maxBuffer: 64 << 20 });
  try {
    return run();
  } catch (e) {
    if (!/401|Unauthorized/.test(String(e.stderr))) throw e;
    try {
      return run();
    } catch {
      console.error("Cloudflare 로그인이 만료됐다. `npx wrangler login` 후 다시 실행하세요.");
      process.exit(1);
    }
  }
}

const input = JSON.parse(fs.readFileSync(file, "utf8"));
if (!input.id) throw new Error("project.json 에 id 가 없다");

// 1. 라이브 데이터 받아 백업
const live = JSON.parse(wrangler("get projects"));
if (!Array.isArray(live)) throw new Error("라이브 데이터 형식이 이상하다 — 중단");
fs.mkdirSync(BACKUPS, { recursive: true });
const stamp = new Date().toISOString().replace(/[-:]/g, "").replace("T", "-").slice(0, 15);
const backup = path.join(BACKUPS, `kv-${stamp}.json`);
fs.writeFileSync(backup, JSON.stringify(live));

// 2. 합치기
const list = structuredClone(live);
let p = list.find((x) => x.id === input.id);
const isNew = !p;
if (isNew) list.push((p = {}));
const changed = [];
for (const [k, v] of Object.entries(input)) {
  const before = JSON.stringify(p[k]);
  if (v === null) delete p[k];
  else p[k] = v;
  if (JSON.stringify(p[k]) !== before) changed.push(k);
}
// 대표작 번호는 하나씩만 — 같은 번호를 쓰던 작업은 대표작에서 뺀다
if (input.feature) {
  for (const x of list) if (x !== p && x.feature === input.feature) {
    delete x.feature;
    delete x.featureNote;
    console.log(`  대표작 ${input.feature}번이던 '${x.title}' 는 대표작에서 빠진다`);
  }
}

// 3. 검증 — /edit 저장과 같은 규칙
const bad = list.findIndex((x) => !isValidProject(x));
if (bad !== -1) throw new Error(`'${list[bad].id}' 가 저장 규칙에 맞지 않는다 (필수 칸·ID 형식·날짜 형식·video 경로를 확인)`);
const dup = findDuplicateId(list);
if (dup) throw new Error(`ID 가 겹친다: ${dup}`);
if ([...(p.summary || "")].length > 60) console.warn(`  ! 한 줄 요약이 60자를 넘는다 (${[...p.summary].length}자)`);

// 4. 저장소 안 파일 확인 — 카드가 가리키는 것들
const assets = [];
if (p.video) assets.push(p.video, p.video.replace(/\.mp4$/, ".jpg"));
const diagram = `assets/diagrams/${p.id}.svg`;
if (fs.existsSync(path.join(ROOT, diagram))) assets.push(diagram);
else console.warn(`  ! 구조 도식이 없다: ${diagram}`);
const shotDir = path.join(ROOT, "assets", "screenshots", p.id);
const shots = fs.existsSync(shotDir) ? fs.readdirSync(shotDir).filter((f) => /\.(png|jpe?g|webp|gif)$/i.test(f)) : [];
if (!shots.length) console.warn(`  ! 스크린샷이 없다: assets/screenshots/${p.id}/`);
else assets.push(`assets/screenshots/${p.id}/${encodeURIComponent(shots[0])}`);
for (const a of assets) if (!fs.existsSync(path.join(ROOT, decodeURIComponent(a)))) throw new Error(`파일이 없다: ${a}`);

console.log(`${isNew ? "새 프로젝트" : "업데이트"}: ${p.id} — ${p.title}`);
console.log(`  바뀌는 칸: ${changed.length ? changed.join(", ") : "(없음)"}`);
console.log(`  백업: ${backup}`);

const writeSeed = () => {
  const s = fs.readFileSync(SEED, "utf8");
  const head = s.slice(0, s.indexOf("export const DEFAULT_PROJECTS"));
  fs.writeFileSync(SEED, `${head}export const DEFAULT_PROJECTS = ${JSON.stringify(list, null, 2)};\n`);
};

if (mode === "check") {
  console.log("확인만 했다. 미리보기: --preview / 게시: --publish");
} else if (mode === "preview") {
  writeSeed();
  console.log("예비본에 썼다. 로컬 미리보기:");
  console.log(`  npx wrangler pages dev . --port 8788   →   http://localhost:8788/#${p.id}`);
  console.log("  (로컬 KV 가 비어 있으면 예비본을 읽는다. 라이브 데이터는 아직 그대로다.)");
} else {
  // 5. 게시 — 그림·영상이 라이브에 올라가 있는지 먼저 (없는 경로는 index.html 이 200 으로 온다)
  if (!force) {
    for (const a of assets) {
      const r = await fetch(`${SITE}/${a}`, { method: "HEAD" });
      const type = r.headers.get("content-type") || "";
      if (!r.ok || type.startsWith("text/html")) throw new Error(`라이브에 아직 없다: ${a} — 먼저 배포한 뒤 다시 (--force 로 건너뛰기)`);
    }
  }
  const tmp = path.join(BACKUPS, `kv-next-${stamp}.json`);
  fs.writeFileSync(tmp, JSON.stringify(list));
  wrangler(`put projects --path "${tmp}"`);
  const check = await (await fetch(`${SITE}/api/projects?v=${Date.now()}`)).json();
  const got = check.find((x) => x.id === p.id);
  if (!got || JSON.stringify(got.title) !== JSON.stringify(p.title)) throw new Error("KV 에 썼지만 라이브 확인이 안 된다 — 백업으로 되돌릴 수 있다");
  writeSeed();
  console.log(`게시했다: ${SITE}/#${p.id}`);
  console.log(`  되돌리기: npx wrangler kv key put projects --path "${backup}" --namespace-id ${NS} --remote`);
}
