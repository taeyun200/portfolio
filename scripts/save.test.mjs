// Run: node scripts/save.test.mjs   (no deps, no framework — exits non-zero on failure)
import assert from "node:assert/strict";
import { isValidProject, findDuplicateId } from "../functions/api/admin/save.js";
import { normalize } from "../functions/_lib/projects.js";
import { DEFAULT_PROJECTS } from "../functions/_lib/default-projects.js";

const ok = {
  id: "my-tool", title: "제목", summary: "한 줄 요약", category: "학교 업무 자동화",
  tags: [], date: "2026-07-31", problem: "무엇을 해결했는가",
  approach: "어떻게 했는가", result: "어떤 효과가 있었는가",
  progress: "done", visibility: "public",
};

// --- validation ---
assert(isValidProject(ok));
assert(isValidProject({ ...ok, approach: ["줄1", "줄2"] }), "approach may be an array");
assert(isValidProject({ ...ok, summary: "", result: "" }), "blank summary/result allowed during backfill");
assert(!isValidProject({ ...ok, id: "" }), "empty id rejected");
assert(!isValidProject({ ...ok, id: "새 프로젝트" }), "non-slug id rejected");
assert(!isValidProject({ ...ok, id: "My-Tool" }), "uppercase id rejected");
assert(!isValidProject({ ...ok, title: "  " }), "blank title rejected");
assert(!isValidProject({ ...ok, problem: "" }), "blank problem rejected");
assert(!isValidProject({ ...ok, date: "2026.07.31" }), "dotted date rejected — must be ISO for sorting");
assert(!isValidProject({ ...ok, tags: "Python" }), "tags must be an array");
const missing = { ...ok };
delete missing.result;
assert(!isValidProject(missing), "missing field rejected");

// 스크린샷 자를 위치 — 선택 필드라 없어도 통과, 있으면 아는 값만
assert(isValidProject({ ...ok, shot: "top" }));
assert(isValidProject({ ...ok, shot: "fit" }));
assert(isValidProject(ok), "shot 없이도 통과");
assert(!isValidProject({ ...ok, shot: "left" }), "모르는 값 거부");
assert(!isValidProject({ ...ok, shot: "url(evil)" }), "임의 CSS 거부");
assert.equal(normalize({ ...ok, shot: "top" }).shot, "top", "normalize 가 shot 을 보존");
assert(!("shot" in normalize(ok)), "기본값이면 필드를 만들지 않는다");

// 시작일 — 선택 필드
assert(isValidProject({ ...ok, start: "2026-07-11" }));
assert(!isValidProject({ ...ok, start: "2026.07.11" }), "시작일도 ISO 여야 정렬·배치가 된다");
assert.equal(normalize({ ...ok, start: "2026-07-11" }).start, "2026-07-11", "normalize 가 start 를 보존");
assert(!("start" in normalize(ok)), "없으면 만들지 않는다");

// 대표작 — 선택 필드
assert(isValidProject({ ...ok, feature: 1, featureNote: "3·6·9월 정규 업무로 사용" }));
assert(!isValidProject({ ...ok, feature: "1" }), "순서는 숫자");
assert(!isValidProject({ ...ok, feature: 0 }), "1부터");
assert.equal(normalize({ ...ok, feature: 2 }).feature, 2, "normalize 가 feature 를 보존");

assert.equal(findDuplicateId([ok, { ...ok, id: "other" }]), null);
assert.equal(findDuplicateId([ok, { ...ok, title: "다른 제목" }]), "my-tool");

// --- v1 -> v2 migration (live KV still holds v1 records) ---
const v1 = {
  id: "hapbul", title: "대입 결과분석 대시보드", category: "대입 · 진학지도",
  status: "done", visibility: "private", purpose: "무엇을 해결했는가",
  method: ["줄1", "줄2"], tags: ["Python"], updated: "2026.07.27",
};
const up = normalize(v1);
assert.equal(up.problem, "무엇을 해결했는가", "purpose -> problem");
assert.deepEqual(up.approach, ["줄1", "줄2"], "method -> approach");
assert.equal(up.progress, "done", "status -> progress");
assert.equal(up.date, "2026-07-27", "updated -> ISO date");
assert.equal(up.summary, "");
assert.equal(up.result, "");
assert(!("repo" in up), "absent repo stays absent");
assert(isValidProject(up), "a migrated v1 record must pass v2 validation");

// v2 records must survive normalize() unchanged (it runs on every read, not just once).
assert.deepEqual(normalize(ok), ok, "normalize is idempotent on v2");

// The seed must pass validation, or every save fails while KV is empty.
DEFAULT_PROJECTS.map(normalize).forEach((p, i) =>
  assert(isValidProject(p), `seed project ${i} (${p.id}) rejected`)
);

console.log("save.js + migration: all checks passed");
