// Scans assets/screenshots/<project-id>/ and lists every image file in each.
// Regenerates js/screenshots.js from the result.
// Run this after adding/replacing a screenshot file, before redeploying.
//
// 한 폴더에 여러 장을 두면 전부 실린다. 첫 번째가 카드 겉면에 쓰이고 나머지는 모달에만
// 나오므로, 순서를 정하고 싶으면 01-·02- 처럼 앞에 번호를 붙이면 된다. 번호가 없으면
// 최신 파일이 앞에 온다 — 한 장만 두던 기존 폴더는 그대로 동작한다.
const fs = require("fs");
const path = require("path");

const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const root = path.join(__dirname, "..");
const shotsDir = path.join(root, "assets", "screenshots");

const result = {};
for (const id of fs.readdirSync(shotsDir)) {
  const dir = path.join(shotsDir, id);
  if (!fs.statSync(dir).isDirectory()) continue;

  const files = fs
    .readdirSync(dir)
    .filter((f) => IMG_EXT.has(path.extname(f).toLowerCase()))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }));

  // 이름순이 기본이라 01-·02- 로 순서를 잡을 수 있고, 그런 이름이 없으면 최신순으로 둔다.
  const numbered = files.every(({ f }) => /^\d/.test(f));
  files.sort((a, b) => (numbered ? a.f.localeCompare(b.f) : b.mtime - a.mtime));

  if (files.length > 0) {
    result[id] = files.map(({ f }) => `assets/screenshots/${id}/${encodeURIComponent(f)}`);
  }
}

const total = Object.values(result).reduce((n, list) => n + list.length, 0);
const out = `const SCREENSHOTS = ${JSON.stringify(result, null, 2)};\n`;
fs.writeFileSync(path.join(root, "js", "screenshots.js"), out);
console.log(`Wrote js/screenshots.js — ${Object.keys(result).length} project(s), ${total} image(s).`);
