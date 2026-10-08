"""프로젝트 설명 영상 만들기.

    python scripts/make-video.py scripts/videos/<id>.json [--no-voice] [--keep]

장면 대본(JSON) → 장면마다 HTML 그림(헤드리스 크롬) → 타입캐스트 음성 → 자막·배경음 → 720p mp4.
결과: assets/videos/<id>.mp4, assets/videos/<id>.jpg(포스터). 대본 형식은 docs/WRITING.md "설명 영상".

음성 키는 저장소 밖 ~/.config/portfolio/.env 에 둔다(TYPECAST_API_KEY, TYPECAST_VOICE_ID).
사이트는 저장소 폴더를 통째로 배포하므로 저장소 안에 키·캐시·작업 파일을 두지 않는다.
음성 생성이 실패하면 전체를 자막 + 배경음으로 만든다 — 장면마다 섞이면 어색하다.
필요한 것: ffmpeg/ffprobe, Chrome. 사이트에는 영향이 없는 제작 도구다.
"""
import argparse
import hashlib
import html
import json
import os
import shutil
import subprocess
import sys
import urllib.error
import urllib.request
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
W, H, FPS = 1280, 720, 30
XF = 0.5  # 장면 사이 겹침(초)
BGM = ROOT / "scripts" / "video" / "bgm.mp3"
SITE = "taeyun-portfolio.pages.dev"
CONFIG = Path.home() / ".config" / "portfolio" / ".env"
CACHE = Path.home() / ".cache" / "portfolio-video"  # 음성 캐시와 작업 폴더 — 저장소 밖
TYPECAST_API = "https://api.typecast.ai/v1/text-to-speech"


def load_config():
    """~/.config/portfolio/.env 의 KEY=VALUE. 같은 이름의 환경변수가 있으면 그쪽이 이긴다."""
    conf = {}
    if CONFIG.exists():
        for line in CONFIG.read_text(encoding="utf-8").splitlines():
            line = line.strip()
            if line and not line.startswith("#") and "=" in line:
                k, v = line.split("=", 1)
                conf[k.strip()] = v.strip()
    for k in ("TYPECAST_API_KEY", "TYPECAST_VOICE_ID", "TYPECAST_MODEL", "TYPECAST_TEMPO"):
        if os.environ.get(k):
            conf[k] = os.environ[k]
    return conf


def find_chrome():
    cands = [
        os.environ.get("CHROME"),
        r"C:\Program Files\Google\Chrome\Application\chrome.exe",
        r"C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
        "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome",
        shutil.which("google-chrome") or "",
        shutil.which("chromium") or "",
    ]
    for c in cands:
        if c and Path(c).exists():
            return c
    sys.exit("Chrome 을 찾지 못했다. 환경변수 CHROME 에 경로를 넣어 주세요.")


def run(cmd):
    r = subprocess.run(cmd, capture_output=True, text=True, encoding="utf-8", errors="replace")
    if r.returncode != 0:
        sys.exit(f"명령 실패: {' '.join(map(str, cmd[:3]))} …\n{r.stderr[-1500:]}")
    return r.stdout


def duration(path):
    return float(run(["ffprobe", "-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", str(path)]).strip())


# ── 장면 그림 ───────────────────────────────────────────
# 사이트와 같은 종이색·먹색·짙은 오렌지. 그림 속 글도 사이트 글처럼 쉬운 말.
CSS = """
<link rel="stylesheet" href="https://cdn.jsdelivr.net/gh/orioncactus/pretendard@v1.3.9/dist/web/variable/pretendardvariable-dynamic-subset.min.css">
<style>
  html, body { margin: 0; width: 1280px; height: 720px; overflow: hidden; }
  body { background: #fbfaf7; color: #1d1a17; word-break: keep-all;
         font-family: "Pretendard Variable", "Pretendard", "Malgun Gothic", sans-serif; }
  body.clear { background: transparent; }
  .pad { position: absolute; inset: 0; padding: 0 110px; display: flex; flex-direction: column; justify-content: center; gap: 22px; }
  .cat { color: #a9460f; font-size: 26px; font-weight: 800; letter-spacing: .02em; }
  h1 { margin: 0; font-size: 70px; font-weight: 900; line-height: 1.2; letter-spacing: -0.02em; max-width: 1000px; }
  .sum { margin: 0; font-size: 30px; color: #6f6860; line-height: 1.5; max-width: 980px; }
  .who { position: absolute; left: 110px; bottom: 56px; font-size: 22px; color: #6f6860; font-weight: 600; }
  .rule { width: 72px; height: 6px; background: #c9561c; border-radius: 3px; }
  .kick { color: #a9460f; font-size: 26px; font-weight: 800; }
  .big { margin: 0; font-size: 46px; font-weight: 800; line-height: 1.45; max-width: 1040px; letter-spacing: -0.01em; }
  .band { position: absolute; inset: 0; background: #f5f2ec; }
  .shot { position: absolute; left: 60px; right: 60px; top: 40px; bottom: 150px; display: flex; align-items: center; justify-content: center; }
  /* 작은 원본도 영역을 채우게 키운다(contain). 그림자는 실제 그림 모양을 따라가도록 drop-shadow. */
  .shot img { width: 100%; height: 100%; object-fit: contain; filter: drop-shadow(0 16px 26px rgba(0,0,0,.28)); }
  .shot.svg img { filter: none; }
  .cap { position: absolute; left: 50%; bottom: 40px; transform: translateX(-50%); max-width: 1080px; width: max-content;
         background: rgba(29,26,23,.88); color: #fbfaf7; font-size: 30px; font-weight: 600; line-height: 1.45;
         padding: 14px 30px; border-radius: 12px; text-align: center; }
  .end { position: absolute; inset: 0; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 18px; text-align: center; }
  .end .t { font-size: 34px; font-weight: 800; }
  .end .u { font-size: 54px; font-weight: 900; letter-spacing: -0.01em; }
  .end .n { font-size: 24px; color: #6f6860; }
</style>"""


def page(body, clear=False):
    return f"<!doctype html><html lang='ko'><head><meta charset='utf-8'>{CSS}</head><body class='{'clear' if clear else ''}'>{body}</body></html>"


def e(s):
    return html.escape(str(s or ""))


def uri(rel):
    p = (ROOT / rel).resolve()
    if not p.exists():
        sys.exit(f"그림 파일이 없다: {rel}")
    return p.as_uri()


def scene_pages(sc, meta):
    """장면 하나 → (바탕 HTML, 자막 HTML 또는 None)."""
    t = sc["type"]
    cap = sc.get("caption", sc.get("say", ""))
    cap_html = page(f"<div class='cap'>{e(cap)}</div>", clear=True) if cap else None
    if t == "title":
        return page(
            f"<div class='pad'><div class='rule'></div><span class='cat'>{e(meta.get('category'))}</span>"
            f"<h1>{e(meta['title'])}</h1><p class='sum'>{e(meta.get('summary'))}</p></div>"
            f"<span class='who'>김태연 · 포트폴리오</span>"), None
    if t == "text":
        return page(f"<div class='pad'><span class='kick'>{e(sc.get('heading'))}</span><p class='big'>{e(sc['text'])}</p></div>"), None
    if t == "image":
        return page(f"<div class='band'></div><div class='shot'><img src='{uri(sc['src'])}'></div>"), cap_html
    if t == "diagram":
        return page(f"<div class='band'></div><div class='shot svg'><img src='{uri(sc['src'])}'></div>"), cap_html
    if t == "end":
        return page(f"<div class='end'><span class='t'>{e(meta['title'])}</span><span class='u'>{SITE}</span>"
                    f"<span class='n'>김태연 · 연수 · 강의 문의는 사이트에서</span></div>"), None
    sys.exit(f"모르는 장면 종류: {t}")


def shoot(chrome, html_path, png_path, clear=False):
    cmd = [chrome, "--headless=new", "--disable-gpu", "--hide-scrollbars", "--force-device-scale-factor=1",
           "--allow-file-access-from-files", f"--window-size={W},{H}", "--virtual-time-budget=4000",
           f"--screenshot={png_path}"]
    if clear:
        cmd.append("--default-background-color=00000000")
    cmd.append(Path(html_path).as_uri())
    subprocess.run(cmd, capture_output=True)
    if not Path(png_path).exists():
        sys.exit(f"장면 그림을 찍지 못했다: {html_path}")


# ── 음성: 타입캐스트 ────────────────────────────────────
# 크레딧을 넘으면 자동 결제되는 계정이라, 같은 문장은 다시 부르지 않는다(캐시).
# 4xx(키·요금제·형식 오류)는 다시 시도해도 같으므로 재시도하지 않는다.
# 목소리마다 쓸 수 있는 모델이 정해져 있다 — 맞지 않으면 404 "Voice model not available".
def model(conf):
    return conf.get("TYPECAST_MODEL") or "ssfm-v30"

def typecast(text, conf, prev="", nxt=""):
    output = {"volume": 100, "audio_format": "mp3"}
    if conf.get("TYPECAST_TEMPO"):
        output["audio_tempo"] = float(conf["TYPECAST_TEMPO"])  # 속도는 output 안. prompt 에 넣으면 422
    body = {
        "voice_id": conf["TYPECAST_VOICE_ID"],
        "text": text,
        "model": model(conf),
        "language": "kor",
        "output": output,
    }
    # v30 은 앞뒤 문장을 보고 말투를 정한다(smart). 장면마다 따로 부르지만 한 사람이 이어 읽는 것처럼 들린다.
    if body["model"] == "ssfm-v30":
        body["prompt"] = {"emotion_type": "smart", "previous_text": prev, "next_text": nxt}
    req = urllib.request.Request(
        TYPECAST_API, data=json.dumps(body).encode("utf-8"), method="POST",
        headers={"X-API-KEY": conf["TYPECAST_API_KEY"], "Content-Type": "application/json"},
    )
    for attempt in range(2):
        try:
            with urllib.request.urlopen(req, timeout=120) as r:
                return r.read()
        except urllib.error.HTTPError as ex:
            msg = ex.read().decode("utf-8", "replace")[:200]
            if ex.code < 500 or attempt:
                raise RuntimeError(f"타입캐스트 {ex.code}: {msg}") from None
        except urllib.error.URLError as ex:
            if attempt:
                raise RuntimeError(f"타입캐스트 연결 실패: {ex.reason}") from None


def make_voice(scenes, conf):
    if not (conf.get("TYPECAST_API_KEY") and conf.get("TYPECAST_VOICE_ID")):
        print(f"  음성 키가 없다({CONFIG}) → 자막 + 배경음으로 만든다")
        return None
    vdir = CACHE / "voice"
    vdir.mkdir(parents=True, exist_ok=True)
    out, fresh = {}, 0
    says = [(i, sc["say"]) for i, sc in enumerate(scenes) if sc.get("say")]
    try:
        for n, (i, say) in enumerate(says):
            prev = says[n - 1][1] if n else ""
            nxt = says[n + 1][1] if n + 1 < len(says) else ""
            sig = "|".join([conf["TYPECAST_VOICE_ID"], model(conf), conf.get("TYPECAST_TEMPO") or "", say])
            if model(conf) == "ssfm-v30":
                sig += f"|{prev}|{nxt}"  # 앞뒤 문장이 바뀌면 말투도 바뀐다
            p = vdir / (hashlib.sha1(sig.encode("utf-8")).hexdigest()[:16] + ".mp3")
            if not p.exists():
                p.write_bytes(typecast(say, conf, prev, nxt))
                fresh += 1
            out[i] = p
    except Exception as ex:
        print(f"  음성 생성 실패 → 자막 + 배경음으로 만든다 ({ex})")
        return None
    print(f"  음성 {len(out)}개 (새로 만든 것 {fresh}개, 나머지는 캐시)")
    return out


# ── 조립 ────────────────────────────────────────────────
def build(story_path, no_voice=False, keep=False):
    story = json.loads(Path(story_path).read_text(encoding="utf-8"))
    vid, scenes = story["id"], story["scenes"]
    for i, sc in enumerate(scenes):
        if len(sc.get("caption", sc.get("say", ""))) > 80 and sc["type"] in ("image", "diagram"):
            print(f"  ! 장면 {i + 1} 자막이 길다({len(sc.get('caption', sc.get('say')))}자) — 두 줄 안쪽이 읽기 좋다")
    chrome = find_chrome()
    tmp = CACHE / "tmp" / vid
    shutil.rmtree(tmp, ignore_errors=True)
    tmp.mkdir(parents=True)

    voices = None if no_voice else make_voice(scenes, load_config())

    durs, clips = [], []
    for i, sc in enumerate(scenes):
        base_html, cap_html = scene_pages(sc, story)
        (tmp / f"s{i}.html").write_text(base_html, encoding="utf-8")
        shoot(chrome, tmp / f"s{i}.html", tmp / f"s{i}.png")
        if cap_html:
            (tmp / f"c{i}.html").write_text(cap_html, encoding="utf-8")
            shoot(chrome, tmp / f"c{i}.html", tmp / f"c{i}.png", clear=True)

        if voices and i in voices:
            d = duration(voices[i]) + 0.9
        else:
            d = min(8.0, 1.2 + len(sc.get("say") or sc.get("text") or "") * 0.11)
        d = max(d, 3.0 if sc["type"] in ("title", "end") else 2.5)
        durs.append(round(d, 2))

        # 장면 안에서는 움직이지 않는다. 천천히 확대(zoompan)하면 매 프레임 위치가 정수 픽셀로 반올림돼
        # 화면 캡처의 글씨·가는 선이 떨려 보였다. 움직임은 장면 사이 전환(xfade)만으로 충분하다.
        clip = tmp / f"v{i}.mp4"
        inputs = ["-loop", "1", "-framerate", str(FPS), "-t", str(d), "-i", str(tmp / f"s{i}.png")]
        fc = "format=yuv420p"
        if cap_html:
            inputs += ["-loop", "1", "-framerate", str(FPS), "-t", str(d), "-i", str(tmp / f"c{i}.png")]
            fc = "[0][1]overlay=0:0,format=yuv420p"
        run(["ffmpeg", "-v", "error", "-y", *inputs, "-filter_complex", fc, "-t", str(d),
             "-c:v", "libx264", "-preset", "veryfast", "-crf", "18", str(clip)])
        clips.append(clip)

    starts, t = [], 0.0
    for d in durs:
        starts.append(t)
        t += d - XF
    total = round(sum(durs) - XF * (len(durs) - 1), 2)

    args = ["ffmpeg", "-v", "error", "-y"]
    for c in clips:
        args += ["-i", str(c)]
    vchain, last = [], "[0:v]"
    for k in range(1, len(clips)):
        out = f"[x{k}]"
        vchain.append(f"{last}[{k}:v]xfade=transition=fade:duration={XF}:offset={starts[k]:.2f}{out}")
        last = out
    vmap = last if len(clips) > 1 else "[0:v]"

    achain, mix = [], []
    idx = len(clips)
    if voices:
        for i, p in voices.items():
            args += ["-i", str(p)]
            ms = int((starts[i] + 0.35) * 1000)
            achain.append(f"[{idx}:a]aresample=44100,adelay={ms}|{ms}[a{i}]")
            mix.append(f"[a{i}]")
            idx += 1
    args += ["-stream_loop", "-1", "-i", str(BGM)]
    vol = 0.10 if voices else 0.32
    achain.append(f"[{idx}:a]aresample=44100,atrim=0:{total},volume={vol},afade=t=in:d=1,"
                  f"afade=t=out:st={max(total - 2.5, 0):.2f}:d=2.5[bg]")
    mix.append("[bg]")
    achain.append(f"{''.join(mix)}amix=inputs={len(mix)}:normalize=0:duration=longest,alimiter=limit=0.95[aout]")

    fc = ";".join(vchain + achain) if vchain else ";".join(achain)
    out = ROOT / "assets" / "videos" / f"{vid}.mp4"
    out.parent.mkdir(parents=True, exist_ok=True)
    args += ["-filter_complex", fc, "-map", vmap if vchain else "0:v", "-map", "[aout]", "-t", str(total),
             "-c:v", "libx264", "-preset", "medium", "-crf", "24", "-profile:v", "high", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "128k", "-movflags", "+faststart", str(out)]
    run(args)
    run(["ffmpeg", "-v", "error", "-y", "-i", str(tmp / "s0.png"), "-q:v", "4", str(out.with_suffix(".jpg"))])

    if not keep:
        shutil.rmtree(tmp, ignore_errors=True)
    size = out.stat().st_size / 1e6
    print(f"{out.relative_to(ROOT)} — {total:.1f}초, {size:.1f}MB, {'타입캐스트 음성' if voices else '자막 + 배경음'}")
    if keep:
        print(f"  장면 그림: {tmp}")
    if size > 20:
        print("  ! 20MB 가 넘는다 — Pages 한 파일 상한(25MB)에 가깝다. 장면을 줄이거나 길이를 줄여 주세요.")


if __name__ == "__main__":
    # Windows 콘솔(cp949)은 '—' 같은 문자를 못 찍는다
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")
    ap = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    ap.add_argument("story", help="scripts/videos/<id>.json")
    ap.add_argument("--no-voice", action="store_true", help="음성 없이 자막 + 배경음")
    ap.add_argument("--keep", action="store_true", help="장면 그림을 ~/.cache/portfolio-video/tmp/<id>/ 에 남긴다")
    a = ap.parse_args()
    build(a.story, a.no_voice, a.keep)
