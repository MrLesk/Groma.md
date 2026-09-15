import { parentPort, workerData } from 'node:worker_threads'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import type { loadPyodide } from 'pyodide'

const runtime = fileURLToPath(new URL('../runtime/pyodide.mjs', import.meta.url))
const { loadPyodide: load }: { loadPyodide: typeof loadPyodide } = await import(runtime)
const python = await load({ indexURL: path.dirname(runtime) })
const { root, files }: { root: string; files: string[] } = workerData
const directory = `/checkout/${path.basename(root)}`
python.FS.mkdirTree(directory)
python.FS.chdir(directory)
for (const file of files) {
  python.FS.mkdirTree(path.posix.dirname(file))
  python.FS.writeFile(file, await readFile(path.join(root, file)))
}
const globals = python.toPy({ __name__: 'groma_scanner', files })
try {
  python.runPython(await readFile(new URL('./scan.py', import.meta.url), 'utf8'), { globals })
  parentPort!.postMessage(python.runPython('json.dumps(scan(files))', { globals }))
} finally { globals.destroy() }
