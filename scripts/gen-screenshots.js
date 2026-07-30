// Scans assets/screenshots/<project-id>/ and picks the newest image file in each
// (any filename works). Regenerates js/screenshots.js from the result.
// Run this after adding/replacing a screenshot file, before redeploying.
const fs = require("fs");
const path = require("path");

const IMG_EXT = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif"]);
const root = path.join(__dirname, "..");
const shotsDir = path.join(root, "assets", "screenshots");

const result = {};
for (const id of fs.readdirSync(shotsDir)) {
  const dir = path.join(shotsDir, id);
  if (!fs.statSync(dir).isDirectory()) continue;

  const candidates = fs
    .readdirSync(dir)
    .filter((f) => IMG_EXT.has(path.extname(f).toLowerCase()))
    .map((f) => ({ f, mtime: fs.statSync(path.join(dir, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime);

  if (candidates.length > 0) {
    result[id] = `assets/screenshots/${id}/${encodeURIComponent(candidates[0].f)}`;
  }
}

const out = `const SCREENSHOTS = ${JSON.stringify(result, null, 2)};\n`;
fs.writeFileSync(path.join(root, "js", "screenshots.js"), out);
console.log(`Wrote js/screenshots.js — ${Object.keys(result).length} screenshot(s) found.`);
