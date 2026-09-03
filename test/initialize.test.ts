import assert from 'node:assert/strict'
import { spawn } from 'node:child_process'
import {
  access,
  mkdir,
  mkdtemp,
  readdir,
  readFile,
  rm,
  writeFile,
} from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadArchitecture } from '../src/architecture-reader.ts'
import { draftElement } from '../src/draft.ts'
import {
  inferPackageInstaller,
  type InitViewer,
  runInitCommand,
} from '../src/init-command.ts'
import { initializeGroma } from '../src/initialize.ts'
import { loadProjectProfile } from '../src/project-profile.ts'
import { initDependencies, initUi } from './init-ui-helpers.ts'

const projectRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
)
const cli = path.join(projectRoot, 'src', 'cli.ts')

function run(args: string[], cwd: string) {
  return new Promise<{ code: number | null; stderr: string }>(
    (resolve, reject) => {
      const child = spawn('bun', [cli, ...args], {
        cwd,
        stdio: ['ignore', 'ignore', 'pipe'],
      })
      let stderr = ''
      child.stderr.setEncoding('utf8')
      child.stderr.on('data', chunk => {
        stderr += chunk
      })
      child.on('error', reject)
      child.on('close', code => resolve({ code, stderr }))
    },
  )
}

async function temporaryRepository(
  runTest: (root: string) => Promise<void>,
): Promise<void> {
  const root = await mkdtemp(path.join(os.tmpdir(), 'groma-initialize-'))
  try {
    await runTest(root)
  } finally {
    await rm(root, { recursive: true, force: true })
  }
}

async function missing(filename: string): Promise<boolean> {
  try {
    await access(filename)
    return false
  } catch {
    return true
  }
}

/** A scanned-looking world: one stable component is what makes onboarding unnecessary. */
async function writeStableWorld(root: string): Promise<void> {
  const documents: Record<string, string> = {
    'groma/systems/shop/system.md': '---\ntype: C4 System\ntitle: Shop\nstatus: stable\ngroma:\n  id: shop\n---\n\nRuns the shop.\n',
    'groma/systems/shop/containers/api/container.md': '---\ntype: C4 Container\ntitle: API\nstatus: stable\ngroma:\n  id: api\n  parent: shop\n---\n\nServes requests.\n',
    'groma/systems/shop/containers/api/components/orders.md': '---\ntype: C4 Component\ntitle: Orders\nstatus: stable\ngroma:\n  id: orders\n  parent: api\n---\n\nHandles orders.\n',
  }
  for (const [relative, source] of Object.entries(documents)) {
    const filename = path.join(root, ...relative.split('/'))
    await mkdir(path.dirname(filename), { recursive: true })
    await writeFile(filename, source)
  }
}

test('interactive initialization asks for identity and storage before creating Groma', {
  concurrency: true,
}, async () => {
  await temporaryRepository(async root => {
    const asked: string[] = []
    const result = await initializeGroma(root, {}, {
      projectName: async () => {
        asked.push('project-name')
        return 'Visible project'
      },
      directory: async () => {
        asked.push('directory')
        return 'groma'
      },
    })

    assert.deepEqual(asked, ['project-name', 'directory'])
    assert.deepEqual(result, {
      directory: 'groma',
      projectName: 'Visible project',
      status: 'initialized',
    })
    assert.deepEqual((await readdir(path.join(root, 'groma'))).sort(), [
      'index.md',
      'project.md',
    ])
    assert.equal((await loadProjectProfile(root))?.title, 'Visible project')
    assert.equal((await loadArchitecture(root)).documents.length, 0)
  })
})

test('non-interactive initialization creates and uses hidden Groma storage', {
  concurrency: true,
}, async () => {
  await temporaryRepository(async root => {
    const result = await run(
      ['init', 'Hidden project', '--directory', '.groma'],
      root,
    )

    assert.equal(result.code, 0, result.stderr)
    assert.equal(await missing(path.join(root, 'groma')), true)
    assert.equal((await loadProjectProfile(root))?.title, 'Hidden project')
    await draftElement(root, {
      kind: 'system',
      name: 'Owner shop',
      overview: 'Owns the hidden architecture.',
    })
    const architecture = await loadArchitecture(root)
    assert.equal(
      architecture.documents[0]?.sourceFilename,
      '.groma/systems/owner-shop/system.md',
    )
  })
})

test('an existing Groma directory is reused without asking for its location', {
  concurrency: true,
}, async () => {
  await temporaryRepository(async root => {
    await mkdir(path.join(root, '.groma'))
    let askedForName = 0
    await initializeGroma(root, {}, {
      projectName: async () => {
        askedForName += 1
        return 'Existing hidden project'
      },
      directory: async () => {
        throw new Error('directory prompt must not run')
      },
    })
    const project = await readFile(path.join(root, '.groma/project.md'), 'utf8')
    const agents = await readFile(path.join(root, 'AGENTS.md'), 'utf8')

    let shownProjectName: string | undefined
    await initializeGroma(root, {}, {
      projectName: async current => {
        shownProjectName = current
        return 'Updated hidden project'
      },
      directory: async () => {
        throw new Error('directory prompt must not run')
      },
    })
    await assert.rejects(initializeGroma(root, { directory: 'groma' }))
    const updatedProject = await readFile(path.join(root, '.groma/project.md'), 'utf8')
    const unchanged = await initializeGroma(root, {
      projectName: 'Updated hidden project',
    })

    assert.equal(askedForName, 1)
    assert.equal(shownProjectName, 'Existing hidden project')
    assert.notEqual(updatedProject, project)
    assert.equal(await readFile(path.join(root, '.groma/project.md'), 'utf8'), updatedProject)
    assert.equal(unchanged.status, 'unchanged')
    assert.equal((await loadProjectProfile(root))?.title, 'Updated hidden project')
    assert.equal(await readFile(path.join(root, 'AGENTS.md'), 'utf8'), agents)
    assert.equal(await missing(path.join(root, 'groma')), true)
  })
})

test('competing Groma directories fail before initialization writes', {
  concurrency: true,
}, async () => {
  await temporaryRepository(async root => {
    await mkdir(path.join(root, 'groma'))
    await mkdir(path.join(root, '.groma'))

    await assert.rejects(initializeGroma(root, {
      projectName: 'Ambiguous project',
      directory: 'groma',
    }))
    assert.equal(await missing(path.join(root, 'AGENTS.md')), true)
    assert.deepEqual(await readdir(path.join(root, 'groma')), [])
    assert.deepEqual(await readdir(path.join(root, '.groma')), [])
  })
})

test('non-interactive initialization requires both explicit values before writing', {
  concurrency: true,
}, async () => {
  await temporaryRepository(async root => {
    await assert.rejects(initializeGroma(root, { projectName: 'Missing directory' }))
    assert.deepEqual(await readdir(root), [])
  })
  await temporaryRepository(async root => {
    await assert.rejects(initializeGroma(root, { directory: 'groma' }))
    assert.deepEqual(await readdir(root), [])
  })
})

test('interactive init scans an empty architecture once and opens the selected viewer', {
  concurrency: true,
}, async () => {
  for (const viewer of ['web', 'view'] as const) {
    await temporaryRepository(async root => {
      const { events, ui } = initUi({
        projectName: 'First project',
        scan: true,
        viewer,
      })
      let scans = 0
      const opened: InitViewer[] = []
      const outcome = await runInitCommand({
        repositoryRoot: root,
        interactive: true,
      }, {
        openViewer: async selectedViewer => {
          opened.push(selectedViewer)
        },
      }, initDependencies(ui, {
        scan: async () => {
          scans += 1
          return { created: 3, refreshed: 0, matched: 0 }
        },
      }))

      assert.equal(outcome, 'completed')
      assert.equal(scans, 1)
      assert.deepEqual(opened, [viewer])
      assert.ok(events.includes('ask:scan'))
      assert.ok(events.includes('ask:viewer'))
    })
  }
})

test('interactive re-init edits the current title and skips onboarding for an established architecture', {
  concurrency: true,
}, async () => {
  await temporaryRepository(async root => {
    await initializeGroma(root, {
      projectName: 'Existing project',
      directory: 'groma',
    })
    await writeStableWorld(root)
    const { events, ui } = initUi({ projectName: 'Renamed project' })

    await runInitCommand({
      repositoryRoot: root,
      interactive: true,
    }, {
      openViewer: async () => {
        throw new Error('viewer must not open')
      },
    }, initDependencies(ui, {
      scan: async () => {
        throw new Error('scan must not run')
      },
    }))

    assert.ok(events.includes('ask:name:Existing project'))
    assert.equal(events.includes('ask:directory'), false)
    assert.equal(events.includes('ask:scan'), false)
    assert.equal((await loadProjectProfile(root))?.title, 'Renamed project')
  })
})

test('init refreshes the managed agent nudge and preserves surrounding instructions', {
  concurrency: true,
}, async () => {
  await temporaryRepository(async root => {
    await initializeGroma(root, {
      projectName: 'Nudge project',
      directory: 'groma',
    })
    await writeFile(path.join(root, 'AGENTS.md'), `Before

<!-- groma:start -->
stale instructions
<!-- groma:end -->

After
`)

    await initializeGroma(root, { projectName: 'Nudge project' })

    const source = await readFile(path.join(root, 'AGENTS.md'), 'utf8')
    assert.match(source, /^Before/m)
    assert.match(source, /^After/m)
    assert.doesNotMatch(source, /stale instructions/)
  })
})

test('interactive init cancellation writes nothing', { concurrency: true }, async () => {
  await temporaryRepository(async root => {
    const { ui } = initUi({ projectName: null })
    const outcome = await runInitCommand({
      repositoryRoot: root,
      interactive: true,
    }, {
      openViewer: async () => undefined,
    }, initDependencies(ui))

    assert.equal(outcome, 'cancelled')
    assert.deepEqual(await readdir(root), [])
  })
})

test('Backlog.md installer follows Groma provenance and optional failure does not stop init', {
  concurrency: true,
}, async () => {
  assert.equal(
    inferPackageInstaller('/Users/test/.bun/install/global/node_modules/groma/src/cli.ts'),
    'bun',
  )
  assert.equal(
    inferPackageInstaller('/usr/local/lib/node_modules/groma/src/cli.ts'),
    'npm',
  )
  assert.equal(
    inferPackageInstaller('/opt/homebrew/Cellar/groma/1.0/bin/groma'),
    'brew',
  )
  assert.equal(inferPackageInstaller('/projects/groma/src/cli.ts'), undefined)

  await temporaryRepository(async root => {
    const { events, ui } = initUi({
      backlogInstall: true,
      projectName: 'Installer project',
      scan: false,
    })
    const outcome = await runInitCommand({
      repositoryRoot: root,
      interactive: true,
    }, {
      openViewer: async () => undefined,
    }, initDependencies(ui, {
      backlogAvailable: () => false,
      executablePath: async () => '/Users/test/.bun/install/global/node_modules/groma/src/cli.ts',
      install: async () => false,
    }))

    assert.equal(outcome, 'completed')
    assert.ok(events.includes('ask:backlog'))
    assert.equal(events.includes('ask:installer'), false)
    assert.equal((await loadProjectProfile(root))?.title, 'Installer project')
  })
})

test('declining Backlog.md installation continues without running an installer', {
  concurrency: true,
}, async () => {
  await temporaryRepository(async root => {
    const { ui } = initUi({
      backlogInstall: false,
      projectName: 'No Backlog project',
      scan: false,
    })
    let installs = 0
    const outcome = await runInitCommand({
      repositoryRoot: root,
      interactive: true,
    }, {
      openViewer: async () => undefined,
    }, initDependencies(ui, {
      backlogAvailable: () => false,
      install: async () => {
        installs += 1
        return true
      },
    }))

    assert.equal(outcome, 'completed')
    assert.equal(installs, 0)
  })
})
