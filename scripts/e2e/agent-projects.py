#!/usr/bin/env python3
"""Playwright-e2e: /projects toont agent-projecten (leeg -> verborgen; item -> Importeren; daarna Openen, geen duplicaat)."""
import json, os, sys
from pathlib import Path
from playwright.sync_api import sync_playwright

URL = os.environ.get("CUT_URL", "http://localhost:3199")
fixture = json.loads((Path(__file__).parents[1] / "agent/fixtures/agent-project.json").read_text())
with sync_playwright() as p:
    b = p.chromium.launch(); page = b.new_context(viewport={"width": 1400, "height": 900}).new_page()
    page.goto(f"{URL}/projects"); page.wait_for_timeout(2500)
    before = page.get_by_test_id("agent-projects").count()
    r = page.request.post(f"{URL}/api/agent/projects", data=fixture)
    print("POST", r.status, r.text()[:200])
    page.reload(); page.get_by_test_id("agent-projects").wait_for(timeout=15000)
    print("sectie leeg->", before, "| items:", page.get_by_test_id("agent-project").count())
    print("tekst:", page.get_by_test_id("agent-project").first.inner_text().replace("\n", " / "))
    page.screenshot(path="/tmp/cut-agent-before.png")
    page.get_by_test_id("agent-project-import").first.click()
    page.get_by_role("link", name="Openen").first.wait_for(timeout=60000)
    print("na import: Openen zichtbaar; import-knoppen:", page.get_by_test_id("agent-project-import").count())
    page.reload(); page.wait_for_timeout(3000)
    n_local = page.locator("a[href^='/editor/']").count()
    print("lokale projectlinks na reload:", n_local, "| agent-items:", page.get_by_test_id("agent-project").count(),
          "| import-knoppen:", page.get_by_test_id("agent-project-import").count())
    page.screenshot(path="/tmp/cut-agent-after.png")
    b.close()
