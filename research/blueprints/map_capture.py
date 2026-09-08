"""Exercise the view controls in the existing browser research runner."""
from __future__ import annotations


def exercise_map_views(browser, base, engine, check, capture):
    context = browser.new_context(viewport={'width': 1728, 'height': 1000})
    page = context.new_page()
    errors = []
    page.on('pageerror', lambda error: errors.append(str(error)))
    page.goto(base)
    page.wait_for_function('!!window.GromaBlueprintResearch')
    state = lambda: page.evaluate('GromaBlueprintResearch.snapshot()')
    def passed(name, condition):
        check('Map views: ' + name, condition, engine)
    def choose(value):
        page.locator(f'#map-controls label:has(input[value="{value}"])').click()
    def action(value):
        page.locator(f'[data-action="{value}"]').filter(visible=True).first.click()
    def screen(name):
        if engine == 'chromium':
            capture(page, name)
    def drag(shift=False):
        rect = page.locator('#map').bounding_box()
        x = rect['x'] + rect['width'] * .72
        y = rect['y'] + rect['height'] * .75
        if shift:
            page.keyboard.down('Shift')
        page.mouse.move(x, y); page.mouse.down()
        page.mouse.move(x + 48, y + 24, steps=5); page.mouse.up()
        if shift:
            page.keyboard.up('Shift')
    def editor(snapshot):
        return {key: value for key, value in snapshot.items() if key != 'map'}
    before = state()['project']
    search = page.locator('#catalogue-search')
    search.fill('saved')
    search_node = search.element_handle()
    choose('2d')
    passed('switching preserves the existing input node and its text', search.input_value() == 'saved' and search_node.evaluate('(node) => node.isConnected'))
    search.focus(); page.keyboard.press('F2')
    passed('F2 does not hijack text editing', state()['map']['view'] == '2d')
    choose('2d')
    plan_camera = state()['map']['camera']
    page.keyboard.press('F2')
    passed('F2 enters the layered view', state()['map']['view'] == 'layers')
    page.keyboard.press('F2')
    passed('F2 returns to the previous 2D camera', state()['map']['view'] == '2d' and state()['map']['camera'] == plan_camera)
    choose('iso')
    page.locator('input[name="map-view"][value="iso"]').focus()
    page.keyboard.press('ArrowRight')
    passed('native radio keyboard navigation selects the next view', state()['map']['view'] == '2d' and page.locator('input[name="map-view"]:checked').count() == 1)
    action('use')
    bindings = editor(state())
    for view in ('iso', 'layers', '2d'):
        choose(view)
        passed('binding form stays unchanged in ' + view, editor(state()) == bindings)
    action('preview')
    preview = editor(state())
    ids = page.locator('#map [data-id]').evaluate_all('(nodes) => [...new Set(nodes.map(node => node.dataset.id))].sort()')
    for view, filename in [('2d', '10-plan-preview-light.png'), ('iso', '11-iso-preview-light.png'), ('layers', '12-layers-preview-light.png')]:
        choose(view)
        actual = page.locator('#map [data-id]').evaluate_all('(nodes) => [...new Set(nodes.map(node => node.dataset.id))].sort()')
        passed('preview participants and unsaved state persist in ' + view, actual == ids and editor(state()) == preview)
        screen(filename)
    choose('2d')
    passed('2D has no wall faces and retains the draft ghost', page.locator('#map .building .face:not(.top)').count() == 0 and page.locator('#map .building.ghost').count() == 1)
    page.get_by_role('button', name='Zoom in', exact=True).click()
    camera = state()['map']['camera']
    drag()
    panned = state()['map']['camera']
    passed('2D drag pans without selecting', panned != camera and editor(state()) == preview)
    choose('iso'); choose('2d')
    passed('each view restores its own zoom and pan', state()['map']['camera'] == panned)
    page.keyboard.press('F2'); page.keyboard.press('F2')
    passed('F2 restores a manually navigated 2D view', state()['map']['camera'] == panned)
    choose('iso'); camera = state()['map']['camera']; drag()
    passed('isometric drag remains available', state()['map']['camera'] != camera and editor(state()) == preview)
    choose('layers'); pose = state()['map']['orbit']; drag()
    passed('layer drag orbits without changing the draft', state()['map']['orbit'] != pose and editor(state()) == preview)
    camera = state()['map']['camera']; pose = state()['map']['orbit']; drag(True)
    passed('Shift-drag pans Layers without orbiting', state()['map']['camera'] != camera and state()['map']['orbit'] == pose)
    choose('2d'); page.get_by_role('button', name='Fit', exact=True).click()
    page.locator('#map .building[data-id="shop-checkout"] .face.top').click()
    selected = state()
    passed('a flat footprint selects the existing component without dropping the preview', selected['selected'] == 'shop-checkout' and selected['previousMode'] == 'preview' and page.locator('#map .building.ghost').count() == 1)
    for view in ('layers', 'iso', '2d'):
        choose(view)
        passed('current selection is preserved in ' + view, editor(state()) == editor(selected))
    page.get_by_label('Theme', exact=True).select_option('dark')
    screen('13-selected-plan-dark.png')
    action('back')
    passed('view exploration has not saved or mutated the project', state()['project'] == before and state()['mode'] == 'preview')
    action('create'); saved = state()['project']
    choose('layers'); choose('2d')
    passed('creation works after switching and the saved draft is unchanged', state()['project'] == saved and len(saved['drafts']) == 1)
    page.set_viewport_size({'width': 430, 'height': 932})
    screen('14-mobile-plan-inspector.png')
    action('mobile-map')
    page.get_by_role('button', name='Fit', exact=True).click()
    screen('15-mobile-plan-map.png')
    choose('layers')
    page.set_viewport_size({'width': 390, 'height': 844})
    passed('narrow Layers controls have no horizontal overflow', page.evaluate('document.documentElement.scrollWidth <= innerWidth'))
    passed('all view choices can be tapped on a narrow screen', page.locator('#map-controls label').evaluate_all("""nodes => nodes.every(node => {
        const r = node.getBoundingClientRect();
        const hit = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return r.x >= 0 && r.right <= innerWidth && (hit === node || node.contains(hit));
    })"""))
    passed('no browser exceptions', not errors)
    context.close()
