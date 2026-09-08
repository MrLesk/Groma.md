"""Exercise the real browser prototype and capture the states reached by its controls.

Usage: python research/blueprints/capture.py
Requires the built dist/blueprint-research/index.html and Playwright 1.57.0 browsers.
Optional: BLUEPRINT_BROWSERS=chromium; BLUEPRINT_TRACK_TASK=TASK-324.
"""
from __future__ import annotations
import functools
import http.server
import json
import os
from pathlib import Path
import subprocess
import threading
import traceback
from playwright.sync_api import sync_playwright

ROOT = Path(__file__).resolve().parents[2]
OUT = ROOT / 'research/blueprints/evidence'
OUT.mkdir(parents=True, exist_ok=True)
RESULTS: list[dict] = []
ERRORS: list[str] = []
NETWORK: list[str] = []


def track(path: Path) -> None:
    task_id = os.environ.get('BLUEPRINT_TRACK_TASK')
    if not task_id:
        return
    value = json.loads(subprocess.check_output(['backlog', 'task', 'view', task_id, '--json'], cwd=ROOT))
    task = value.get('task', value)
    files = task.get('modifiedFiles', [])
    relative = path.relative_to(ROOT).as_posix()
    if relative not in files:
        files.append(relative)
    subprocess.run(['backlog', 'task', 'edit', task_id, *[arg for f in files for arg in ('--modified-file', f)]], cwd=ROOT, check=True, stdout=subprocess.DEVNULL)


def check(name: str, condition: bool, engine: str = 'chromium') -> None:
    RESULTS.append({'engine': engine, 'name': name, 'passed': bool(condition)})
    if not condition:
        raise AssertionError(name)


def state(page):
    return page.evaluate('window.GromaBlueprintResearch.snapshot()')


def action(page, value):
    page.locator(f'[data-action="{value}"]').filter(visible=True).first.click()


def capture(page, filename):
    page.evaluate('document.fonts.ready')
    page.wait_for_timeout(350)  # Allow the existing map camera's paint to settle for capture.
    path = OUT / filename
    page.screenshot(path=str(path), full_page=True)
    track(path)


def open_page(context, base, project='shop', theme='light'):
    page = context.new_page()
    page.on('pageerror', lambda error: ERRORS.append(str(error)))
    page.on('dialog', lambda dialog: dialog.accept())
    page.goto(f'{base}/?project={project}&theme={theme}')
    page.wait_for_function('!!window.GromaBlueprintResearch')
    return page


def explicit_paste(page, text):
    action(page, 'paste')
    page.locator('#paste-text').fill(text)
    action(page, 'load-paste')


def choose_checkout(page, project='market'):
    page.get_by_label('Bind Checkout', exact=True).select_option(project + '-checkout')


def primary(browser, base):
    context = browser.new_context(viewport={'width': 1728, 'height': 1000}, permissions=['clipboard-read', 'clipboard-write'])
    context.on('request', lambda request: NETWORK.append(request.url) if not request.url.startswith(base) else None)
    source = open_page(context, base)
    before_source = state(source)['project']
    capture(source, '01-library-light.png')
    action(source, 'copy')
    text = source.evaluate('navigator.clipboard.readText()')
    check('Copy uses the real browser clipboard', text.startswith('groma-blueprint:1:'))
    check('Copy does not change the source project', state(source)['project'] == before_source)
    target = open_page(context, base, 'market', 'dark')
    before = state(target)['project']
    action(target, 'paste')
    target.locator('#paste-text').focus()
    target.keyboard.press('Control+V')
    check('Native paste reaches the text field without triggering placement', target.locator('#paste-text').input_value() == text and state(target)['mode'] == 'catalogue')
    capture(target, '02-paste-dark.png')
    action(target, 'load-paste')
    check('Unknown component binding is not guessed in the receiving project', 'checkout' not in state(target)['bindings'])
    check('Incomplete placement cannot be previewed', target.locator('[data-action="preview"]').is_disabled())
    target.get_by_label('Theme', exact=True).select_option('blueprint')
    capture(target, '03-bind-missing.png')
    choose_checkout(target)
    check('Existing role is explicitly bound to receiving architecture', state(target)['bindings']['checkout'] == 'market-checkout')
    action(target, 'preview')
    preview = state(target)
    check('Preview leaves every current record unchanged', preview['project'] == before)
    check('Preview resolves new component parent', preview['placement']['draft']['parts'][0]['parent'] == 'market-api')
    check('Preview uses the real Groma map renderer for a ghost', target.locator('#map .building.draft').count() == len(preview['placement']['draft']['parts']))
    capture(target, '04-preview-blueprint.png')
    target.get_by_label('Theme', exact=True).select_option('dark')
    action(target, 'create')
    saved = state(target)['project']
    check('Create persists one independent fixture draft', len(saved['drafts']) == 1)
    check('Create preserves current source evidence and current relationships', saved['elements'] == before['elements'] and saved['relationships'] == before['relationships'])
    capture(target, '05-created-dark.png')
    target.reload()
    target.wait_for_function('!!window.GromaBlueprintResearch')
    check('Draft survives browser reload', state(target)['project'] == saved)
    target.locator('[data-draft]').first.click()
    action(target, 'copy-draft')
    check('Copy original intent excludes receiving-project facts', target.evaluate('navigator.clipboard.readText()') == text)
    target.locator('#context').click()
    target.keyboard.press('Control+V')
    target.wait_for_function('window.GromaBlueprintResearch.snapshot().mode === "bindings"')
    check('Native paste outside editors starts placement', state(target)['mode'] == 'bindings')
    choose_checkout(target)
    action(target, 'preview'); action(target, 'create')
    twice = state(target)['project']
    check('Repeated paste allocates independent identities', len(twice['drafts']) == 2 and twice['drafts'][0]['id'] != twice['drafts'][1]['id'] and twice['drafts'][0]['parts'][0]['id'] != twice['drafts'][1]['parts'][0]['id'])
    check('Overlapping drafts do not reassign current component membership', twice['elements'] == before['elements'] and twice['drafts'][0]['bindings']['checkout'] == twice['drafts'][1]['bindings']['checkout'])
    target.get_by_label('Theme', exact=True).select_option('light')
    target.locator('[data-element="market-checkout"]').click()
    capture(target, '06-overlapping-drafts.png')
    action(source, 'use'); action(source, 'preview'); action(source, 'bindings'); action(source, 'cancel')
    check('Cancel leaves no draft or source changes', state(source)['project'] == before_source)
    action(source, 'paste')
    source.locator('#paste-text').fill('groma-blueprint:9:not-supported')
    action(source, 'load-paste')
    check('Unsupported blueprint preserves project and paste input', state(source)['project'] == before_source and source.locator('#dialog-error').inner_text() != '' and source.locator('#paste-text').input_value().endswith('not-supported'))
    capture(source, '07-invalid-paste.png')
    source.keyboard.press('Escape')
    action(source, 'use'); action(source, 'preview')
    other = open_page(context, base)
    action(other, 'use'); action(other, 'preview'); action(other, 'create')
    action(source, 'create')
    check('Sequentially stale save is refused and keeps the preview', state(source)['mode'] == 'preview' and 'another tab' in state(source)['error'])
    check('Stale save does not overwrite the other tab', len(state(other)['project']['drafts']) == 1 and len(json.loads(source.evaluate('localStorage.getItem("groma:blueprint-research:1:shop")'))['drafts']) == 1)
    capture(source, '08-stale-preview.png')
    action(target, 'back')
    target.set_viewport_size({'width': 430, 'height': 932})
    check('Narrow layout has no horizontal overflow', target.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    footer = target.locator('.panel-footer').bounding_box()
    check('Narrow layout keeps primary actions visible', bool(footer and footer['y'] + footer['height'] <= 932))
    capture(target, '09-mobile-draft.png')
    check('No external network requests', not NETWORK)
    context.close()
    return text


def secondary(browser, base, engine, text):
    context = browser.new_context(viewport={'width': 1366, 'height': 900})
    page = open_page(context, base, 'market')
    before = state(page)['project']
    explicit_paste(page, text)
    choose_checkout(page)
    action(page, 'preview')
    check('Explicit paste, binding and preview preserve current data', state(page)['project'] == before, engine)
    action(page, 'create')
    saved = state(page)['project']
    page.reload(); page.wait_for_function('!!window.GromaBlueprintResearch')
    check('Created draft persists after reload', state(page)['project'] == saved and len(saved['drafts']) == 1, engine)
    check('Current records are unchanged', saved['elements'] == before['elements'] and saved['relationships'] == before['relationships'], engine)
    page.locator('[data-draft]').first.click()
    check('Real renderer displays the saved draft', page.locator('#map .building').count() >= 5, engine)
    context.close()


class QuietHandler(http.server.SimpleHTTPRequestHandler):
    def log_message(self, *_args):
        pass


handler = functools.partial(QuietHandler, directory=str(ROOT / 'dist/blueprint-research'))
server = http.server.ThreadingHTTPServer(('127.0.0.1', 0), handler)
threading.Thread(target=server.serve_forever, daemon=True).start()
base = f'http://127.0.0.1:{server.server_port}'
versions = {}
failed = None
try:
    with sync_playwright() as playwright:
        browser = playwright.chromium.launch()
        versions['chromium'] = browser.version
        text = primary(browser, base)
        browser.close()
        for name in os.environ.get('BLUEPRINT_BROWSERS', 'firefox,webkit').split(','):
            if name not in ('firefox', 'webkit'):
                continue
            browser = getattr(playwright, name).launch()
            versions[name] = browser.version
            secondary(browser, base, name, text)
            browser.close()
        check('No uncaught browser exceptions', not ERRORS, 'all')
except Exception:
    failed = traceback.format_exc()
finally:
    server.shutdown()
    report = {'browsers': versions, 'results': RESULTS, 'pageErrors': ERRORS, 'externalRequests': NETWORK, 'failure': failed,
              'limits': ['Fixture localStorage only; no production Groma writes.', 'Stale checking is sequential detection, not a cross-tab atomic compare-and-swap.', 'WebKit automation is not a certification of Safari on a physical Mac.', 'Screenshots are from the actual prototype, not hand-painted mockups.']}
    path = OUT / 'browser-results.json'
    path.write_text(json.dumps(report, indent=2) + '\n')
    track(path)
    print(json.dumps(report, indent=2))
if failed:
    raise SystemExit(1)
