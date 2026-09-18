import { expect, test } from 'bun:test'
import { cp, mkdtemp, readdir, rename, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import type { ScannerPlugin } from '@groma/scanner'

import angular from '../plugins/scanners/angular/src/index.ts'
import csharp from '../plugins/scanners/csharp/src/index.ts'
import go from '../plugins/scanners/go/src/index.ts'
import javascript from '../plugins/scanners/javascript/src/index.ts'
import java from '../plugins/scanners/java/src/index.ts'
import php from '../plugins/scanners/php/src/index.ts'
import python from '../plugins/scanners/python/src/index.ts'
import react from '../plugins/scanners/react/src/index.ts'
import rust from '../plugins/scanners/rust/src/index.ts'
import swift from '../plugins/scanners/swift/src/index.ts'
import typescript from '../plugins/scanners/typescript/src/index.ts'
import vue from '../plugins/scanners/vue/src/index.ts'

/** Each official scanner lists the sources its own scan selects, without running a project tool. */
const listings: [ScannerPlugin, string, string[]][] = [
  [typescript, 'operation-wiring', ['api.ts', 'caller.ts', 'provider.ts', 'worker.ts', 'wrapper.ts']],
  [go, 'go-module', ['caller.go', 'provider/provider.go']],
  [python, 'python-project', ['nested/worker.py', 'service.py']],
  [php, 'php-source', ['plugin.php', 'view.php']],
  [csharp, 'csharp-operations', [
    'App/Calls.cs', 'App/Program.cs', 'App/Wrapper.cs',
    'Core/Partial.Declaration.cs', 'Core/Partial.Implementation.cs', 'Core/Providers.cs',
  ]],
  [java, 'java-maven', [
    'src/main/java/Caller.java', 'src/main/java/Port.java', 'src/main/java/Provider.java',
    'src/main/java/Shapes.java', 'src/main/java/Unused.java',
  ]],
  [rust, 'rust-semantic', ['src/api.rs', 'src/lib.rs', 'src/provider.rs', 'src/unreferenced.rs']],
  // A minified name, minified text and a TypeScript file are all outside the authored selection.
  [javascript, 'javascript-source', ['public/legacy.js', 'src/cart.mjs', 'src/panel.jsx', 'src/totals.cjs']],
  // A component's template and stylesheets are read besides its class.
  [angular, 'angular-output', [
    'emitter.css', 'emitter.html', 'emitter.ts', 'host.html', 'host.scss', 'host.ts', 'shared.css',
  ]],
  // Next.js route files are read besides the components; middleware and declarations are not.
  [react, 'react-http', [
    'app/api/(admin)/audit/route.ts', 'app/api/docs/[[...slug]]/route.ts', 'app/api/files/[...path]/route.ts',
    'app/api/index/route.ts', 'app/api/talks/[id]/route.ts', 'app/api/talks/route.ts', 'drafts.tsx',
    'options.tsx', 'pages/api.tsx', 'pages/api/drafts/index.ts', 'pages/api/health.ts', 'pages/api/index/list.ts',
    'pages/api/speakers/[id].ts', 'required.tsx', 'shadow.tsx', 'src/app/api/status/route.ts', 'talks.tsx',
    'uncertain.tsx', 'wrapped.tsx',
  ]],
  // A package manifest is not analyzed source.
  [swift, 'swift-source', ['Ledger.swift', 'Other.swift']],
  // The Nuxt project sits below the repository root, so its server routes are listed project-relative.
  [vue, 'vue-http', [
    'web/Talks.vue', 'web/client.ts', 'web/composables/useFetch.ts', 'web/drafts.ts',
    'web/server/api/(admin)/users.get.ts', 'web/server/api/[resource].get.ts',
    'web/server/api/docs/[...file-path].get.ts', 'web/server/api/drafts/index.get.ts',
    'web/server/api/files/[...path].get.ts', 'web/server/api/hello-[name].get.ts', 'web/server/api/imported.get.ts',
    'web/server/api/optional/[[opt]].get.ts', 'web/server/api/settings.ts', 'web/server/api/speakers.get.prod.ts',
    'web/server/api/talks.get.ts', 'web/server/api/talks.post.ts', 'web/server/api/talks/[id].delete.ts',
    'web/server/api/talks/[id].get.ts', 'web/server/api/talks/declared.get.ts', 'web/server/api/talks/named.get.ts',
    'web/server/api/wild/[...].ts', 'web/server/handlers.ts', 'web/server/middleware/auth.ts',
    'web/server/routes/feed.tsx', 'web/server/routes/health.ts', 'web/undici.ts',
  ]],
]

async function repository(fixture: string): Promise<string> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-listing-'))
  await cp(path.resolve(import.meta.dir, `../test/fixtures/${fixture}`), root, { recursive: true })
  for (const name of await readdir(root, { recursive: true })) {
    if (name.endsWith('.fixture')) await rename(path.join(root, name), path.join(root, name.replace(/\.fixture$/, '')))
  }
  const child = Bun.spawn(['git', 'init', '--quiet'], { cwd: root, stdout: 'ignore', stderr: 'pipe' })
  expect(await child.exited, await new Response(child.stderr).text()).toBe(0)
  return root
}

for (const [scanner, fixture, expected] of listings) {
  test.concurrent(`the ${scanner.id} scanner lists the files it would analyze`, async () => {
    const root = await repository(fixture)
    try {
      const files = await scanner.listSourceFiles?.(root)
      expect(files?.sort()).toEqual(expected)
    } finally { await rm(root, { recursive: true, force: true }) }
  })
}

test.concurrent('a stylesheet is listed only by a scanner that reads component styles', async () => {
  const [angularRoot, reactRoot] = await Promise.all([repository('angular-output'), repository('react-http')])
  try {
    await writeFile(path.join(reactRoot, 'globals.css'), 'body { color: black }\n')
    expect(await angular.listSourceFiles?.(angularRoot)).toContain('emitter.css')
    expect(await react.listSourceFiles?.(reactRoot)).not.toContain('globals.css')
  } finally {
    await Promise.all([angularRoot, reactRoot].map(root => rm(root, { recursive: true, force: true })))
  }
})
