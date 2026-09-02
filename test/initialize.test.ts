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
import { createArchitectureElement } from '../src/create.ts'
import {
  inferPackageInstaller,
  type InitCommandDependencies,
  type InitCommandUi,
  type InitViewer,
  runInitCommand,
} from '../src/init-command.ts'
import { initializeGroma } from '../src/initialize.ts'
import { loadProjectProfile } from '../src/project-profile.ts'

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

interface UiAnswers {
  backlogInstall?: boolean | null
  directory?: 'groma' | '.groma' | null
  installer?: 'bun' | 'npm' | 'brew' | null
  projectName?: string | null
  scan?: boolean | null
  viewer?: InitViewer | 'finish' | null
}

function initUi(answers: UiAnswers = {}) {
  const events: string[] = []
  const ui: InitCommandUi = {
    cancel: () => undefined,
    confirmBacklogInstall: async () => {
      events.push('ask:backlog')
      return answers.backlogInstall === null
        ? undefined
        : answers.backlogInstall ?? false
    },
    confirmScan: async () => {
      events.push('ask:scan')
      return answers.scan === null ? undefined : answers.scan ?? false
    },
    directory: async () => {
      events.push('ask:directory')
      return answers.directory === null
        ? undefined
        : answers.directory ?? 'groma'
    },
    error: () => undefined,
    install: async (_, operation) => operation(),
    installer: async () => {
      events.push('ask:installer')
      return answers.installer === null
        ? undefined
        : answers.installer ?? 'bun'
    },
    intro: () => undefined,
    note: () => undefined,
    outro: () => undefined,
    projectName: async current => {
      events.push(`ask:name:${current ?? ''}`)
      return answers.projectName === null
        ? undefined
        : answers.projectName ?? current ?? 'Test project'
    },
    viewer: async () => {
      events.push('ask:viewer')
      return answers.viewer === null
        ? undefined
        : answers.viewer ?? 'finish'
    },
  }
  return { events, ui }
}

function initDependencies(
  ui: InitCommandUi,
  overrides: Partial<InitCommandDependencies> = {},
): Partial<InitCommandDependencies> {
  return {
    backlogAvailable: () => true,
    executablePath: async () => '/usr/local/lib/node_modules/groma/src/cli.ts',
    install: async () => true,
    output: () => undefined,
    scan: async () => ({ created: 0, refreshed: 0, matched: 0 }),
    ui,
    ...overrides,
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
      'missing',
      'observed',
      'plans',
      'project.md',
    ])
    assert.equal((await loadProjectProfile(root))?.title, 'Visible project')
    assert.equal((await loadArchitecture(root)).length, 2)
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
    await createArchitectureElement(root, {
      name: 'Owner',
      observed: true,
      kind: 'actor',
      overview: 'Owns the hidden architecture.',
    })
    const architecture = await loadArchitecture(root)
    assert.equal(
      architecture[0]?.documents[0]?.sourceFilename,
      '.groma/observed/actors/owner.md',
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
    const system = await createArchitectureElement(root, {
      name: 'Shop',
      observed: true,
      kind: 'system',
      overview: 'Runs the shop.',
    })
    const container = await createArchitectureElement(root, {
      name: 'API',
      observed: true,
      kind: 'container',
      parent: system,
      overview: 'Serves requests.',
    })
    await createArchitectureElement(root, {
      name: 'Orders',
      observed: true,
      kind: 'component',
      parent: container,
      overview: 'Handles orders.',
    })
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
