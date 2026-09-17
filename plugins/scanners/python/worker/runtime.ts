import { parentPort, workerData } from 'node:worker_threads'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { loadPyodide } from 'pyodide'
import type { SourceReference } from '@groma/scanner'

const runtime = fileURLToPath(new URL('../runtime/pyodide.mjs', import.meta.url))
const { loadPyodide: load }: { loadPyodide: typeof loadPyodide } = await import(runtime)
const python = await load({ indexURL: path.dirname(runtime) })
/** With references, the worker outlines those files instead of scanning. */
const { root, files: scanned, references }: { root: string; files?: string[]; references?: SourceReference[] } = workerData
const files = references?.map(reference => reference.file) ?? scanned!
const directory = `/checkout/${path.basename(root)}`
python.FS.mkdirTree(directory)
python.FS.chdir(directory)
for (const file of files) {
  python.FS.mkdirTree(path.posix.dirname(file))
  python.FS.writeFile(file, await readFile(path.join(root, file)))
}
const globals = python.toPy({ __name__: 'groma_scanner', files, references })
try {
  python.runPython(await readFile(new URL('./scan.py', import.meta.url), 'utf8'), { globals })
  const call = references === undefined ? 'scan(files)' : 'outline(references)'
  parentPort!.postMessage(python.runPython(`json.dumps(${call})`, { globals }))
} finally { globals.destroy() }
