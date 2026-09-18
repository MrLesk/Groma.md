import type { ScanHttpRequest } from '@groma/scanner'
import { methodToken, type SentRequest } from './http-clients.ts'
import { requestUrl, type Constants, type RequestUrl } from './http-url.ts'
import { receiverName } from './receivers.ts'
import { calledFunction, field, list, qualifiedName, type Fields } from './syntax.ts'

/** What one operation's cURL calls state about their handles. */
interface CurlUse {
  /** Handles the calls name or bind, spelled `$handle`; `?` stands for one the scanner cannot follow. */
  handles: Set<string>
  inits: number
  /** `curl_init` results assigned to a handle. */
  bound: number
  urls: RequestUrl[]
  methods: Set<string>
  /** Set by an option the scanner cannot read, which could change the URL or the method. */
  unreadable: boolean
}

const optionCalls = new Set(['curl_setopt', 'curl_setopt_array'])

/** `true` or `1`, as PHP code commonly writes a switched-on option. */
function switchedOn(value: Fields | undefined): boolean {
  return (value?.kind === 'boolean' && value.value === true) || (value?.kind === 'number' && value.value === '1')
}

/** An option a cURL call sets; any option the scanner cannot read leaves the request unproved. */
function readOption(use: CurlUse, option: Fields | undefined, value: Fields | undefined, constants: Constants): void {
  const name = option?.kind === 'name' ? qualifiedName(String(option.name)) : undefined
  const method = name === 'CURLOPT_CUSTOMREQUEST' ? methodToken(value, constants)
    : name === 'CURLOPT_POST' && switchedOn(value) ? 'POST' : undefined
  if (name === 'CURLOPT_URL') use.urls.push(requestUrl(value, constants, false))
  else if (method !== undefined) use.methods.add(method)
  else if (name === undefined || name === 'CURLOPT_CUSTOMREQUEST' || name === 'CURLOPT_POST') use.unreadable = true
}

function readOptions(use: CurlUse, name: string, args: Fields[], constants: Constants): void {
  use.handles.add(receiverName(args[0]) ?? '?')
  if (name === 'curl_setopt') readOption(use, args[1], args[2], constants)
  else if (args[1]?.kind !== 'array') use.unreadable = true
  else for (const item of list(args[1], 'items')) readOption(use, field(item, 'key'), field(item, 'value'), constants)
}

/** How a node takes part in cURL: `$handle = curl_init(...)`, the `curl_init` call, or an option call. */
function curlRole(node: Fields): 'bind' | 'init' | 'options' | undefined {
  const right = node.kind === 'assign' ? field(node, 'right') : undefined
  if (right !== undefined && calledFunction(right) === 'curl_init') return 'bind'
  const name = calledFunction(node)
  if (name === 'curl_init') return 'init'
  return name !== undefined && optionCalls.has(name) ? 'options' : undefined
}

/** The request one operation's cURL calls prove: one handle from one `curl_init`, with readable options. */
function provedRequest(use: CurlUse): SentRequest | undefined {
  const [handle] = use.handles
  const [url] = use.urls
  const [method] = use.methods
  const oneHandle = use.handles.size === 1 && handle !== '?' && use.inits === 1 && use.bound === 1
  if (!oneHandle || use.unreadable || use.urls.length !== 1 || use.methods.size > 1) return undefined
  return { ...(method === undefined ? {} : { method }), ...url! }
}

/**
 * Collects `curl_init`, `curl_setopt` and `curl_setopt_array` calls per operation. The scanner does
 * not follow a handle through aliases or into other operations, so an operation reports a request
 * only when its calls configure one handle.
 */
export function curlRequests() {
  const uses = new Map<string, CurlUse>()
  return {
    record(operation: string, node: Fields, constants: Constants): void {
      const role = curlRole(node)
      if (role === undefined) return
      const use = uses.get(operation) ?? { handles: new Set(), inits: 0, bound: 0, urls: [], methods: new Set(), unreadable: false }
      uses.set(operation, use)
      const args = list(node, 'arguments')
      if (role === 'bind') {
        use.bound++
        use.handles.add(receiverName(field(node, 'left')) ?? '?')
      } else if (role === 'init') {
        use.inits++
        if (args[0] !== undefined) use.urls.push(requestUrl(args[0], constants, false))
      } else readOptions(use, calledFunction(node)!, args, constants)
    },
    requests(): ScanHttpRequest[] {
      return [...uses].flatMap(([operation, use]) => {
        const request = provedRequest(use)
        return request === undefined ? [] : [{ operation, ...request }]
      })
    },
  }
}
