#!/usr/bin/env python3
"""
Playwright-e2e: EDL/OTIO/FCPXML -> import-dialoog -> project in IndexedDB -> export gelijk.
Vereist: dev-server met CUT_DEV_AUTH=1 CUT_APP_URL=http://localhost:3199 (localhost, geen productie),
ffmpeg, bun, python playwright.   CUT_URL=http://localhost:3199 python3 scripts/e2e/import-roundtrip.py
"""
import json, os, subprocess, sys, tempfile
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("CUT_URL", "http://localhost:3199")
HERE = Path(__file__).parent
tmp = Path(tempfile.mkdtemp(prefix="cut-import-e2e-"))

def ff(*args):
    subprocess.run(["ffmpeg", "-y", "-loglevel", "error", *args], check=True)

ff("-f", "lavfi", "-i", "testsrc=size=160x90:rate=25:duration=30", "-f", "lavfi", "-i", "sine=duration=30", "-shortest",
   "-c:v", "libx264", "-pix_fmt", "yuv420p", "-c:a", "aac", str(tmp / "interview-a.mp4"))
ff("-f", "lavfi", "-i", "testsrc2=size=160x90:rate=25:duration=30", "-c:v", "libx264", "-pix_fmt", "yuv420p", str(tmp / "b-roll.mov"))
ff("-f", "lavfi", "-i", "color=c=red:size=160x90", "-frames:v", "1", str(tmp / "overlay.png"))
ff("-f", "lavfi", "-i", "sine=duration=30", str(tmp / "muziek.wav"))
subprocess.run(["bun", str(HERE / "interchange-fixtures.ts"), "gen", str(tmp)], check=True)

results = []
with sync_playwright() as p:
    browser = p.chromium.launch()
    for ext in ["otio", "fcpxml", "edl"]:
        ctx = browser.new_context(viewport={"width": 1400, "height": 900})
        page = ctx.new_page()
        page.goto(f"{URL}/projects")
        page.get_by_test_id("import-open").click()
        page.get_by_test_id("import-timeline").set_input_files(str(tmp / f"sample.{ext}"))
        page.get_by_test_id("import-summary").wait_for()
        summary = page.get_by_test_id("import-summary").inner_text()
        page.get_by_test_id("import-media").set_input_files([str(tmp / n) for n in ["muziek.wav", "overlay.png", "b-roll.mov", "interview-a.mp4"]])
        statuses = page.get_by_test_id("import-ref-status").all_inner_texts()
        assert len(statuses) == 4 and all(s.startswith("Automatisch") for s in statuses), statuses
        page.get_by_test_id("import-run").click()
        page.wait_for_url("**/editor/**", timeout=60000)
        pid = page.url.rstrip("/").split("/")[-1]
        page.wait_for_timeout(4000)
        dump = page.evaluate("""async () => {
          const dbs = (await indexedDB.databases()).map(d => d.name);
          const name = dbs.find(n => !/media/i.test(n) && /project/i.test(n));
          const db = await new Promise((res, rej) => { const r = indexedDB.open(name); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
          const all = await new Promise((res) => { const q = db.transaction('projects').objectStore('projects').getAll(); q.onsuccess = () => res(q.result); });
          return { project: all[0] };
        }""")
        meta = page.evaluate("""async (pid) => {
          const db = await new Promise((res, rej) => { const r = indexedDB.open('video-editor-media-' + pid); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
          return await new Promise((res) => { const q = db.transaction('media-metadata').objectStore('media-metadata').getAll(); q.onsuccess = () => res(q.result.map(a => ({id: a.id, name: a.name}))); });
        }""", pid)
        (tmp / "assets.json").write_text(json.dumps(meta))
        (tmp / f"project-{ext}.json").write_text(json.dumps(dump["project"]))
        clips_in_ui = page.locator("[data-element-id], [data-testid*='timeline-element']").count()
        out = subprocess.run(["bun", str(HERE / "interchange-fixtures.ts"), "export", str(tmp), ext, str(tmp / f"project-{ext}.json")], capture_output=True, text=True)
        print(ext, "|", summary, "|", statuses, "|", out.stdout.strip(), out.stderr.strip()[:300])
        results.append(out.returncode == 0)
        page.screenshot(path=str(tmp / f"editor-{ext}.png"))
        ctx.close()

    # agent-projecten: leeg -> sectie verborgen; met inbox-item -> zichtbaar
    browser.close()
print("tmp:", tmp)
sys.exit(0 if all(results) else 1)
