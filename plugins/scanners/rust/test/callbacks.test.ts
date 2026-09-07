import { expect, test } from 'bun:test'
import { fixture, scan } from './helpers.ts'

test.concurrent('named function-pointer invocation binds to the supplied canonical implementation', async () => {
  await fixture({}, async root => {
    const result = await scan(root)
    const call = result.invocations!.find(call => call.binding)!
    expect(call.member).toBe('opened')
    expect(call.unresolved).toBe(false)
    expect(call.binding).toEqual({ file: 'backend/src/lib.rs', line: 4 })
    expect(result.operations!.find(operation => operation.id === call.source)?.file).toBe('backend/src/worker.rs')
    expect(result.operations!.find(operation => operation.id === call.targets[0])?.file).toBe('backend/src/provider.rs')
  }, true)
})

test.concurrent('different suppliers keep their bindings separate', async () => {
  await fixture({ 'backend/src/lib.rs': `mod provider; mod worker;
fn noop() {}
fn first() { worker::run(worker::Hooks { opened: provider::open }); }
fn second() { worker::run(worker::Hooks { opened: noop }); }
` }, async root => {
    const result = await scan(root)
    const bindings = result.invocations!.filter(call => call.binding)
    expect(bindings).toHaveLength(2)
    expect(new Set(bindings.map(call => call.binding!.line)).size).toBe(2)
    expect(new Set(bindings.flatMap(call => call.targets)).size).toBe(2)
  }, true)
})

for (const [label, worker] of Object.entries({
  merelyPassed: 'pub fn run(hooks: Hooks) { let _ = hooks; }',
  mutableParameter: 'pub fn run(mut hooks: Hooks) { (hooks.opened)(); }',
  shadowed: 'pub fn run(hooks: Hooks) { let hooks = other(); (hooks.opened)(); }',
  closure: 'pub fn run(hooks: Hooks) { let _ = || (hooks.opened)(); }',
  asyncBlock: 'pub fn run(hooks: Hooks) { let _ = async { (hooks.opened)(); }; }',
  generic: 'pub fn run<Hooks>(hooks: Hooks) { (hooks.opened)(); }',
  macroMutation: 'pub fn run(hooks: Hooks) { replace!(); (hooks.opened)(); }',
})) {
  test.concurrent(`${label} does not manufacture a supplied-callback relationship`, async () => {
    await fixture({ 'backend/src/worker.rs': `pub struct Hooks { pub opened: fn() }\n${worker}\n` }, async root => {
      expect((await scan(root)).invocations!.filter(call => call.binding)).toEqual([])
    }, true)
  })
}

test.concurrent('conditional provider remains unresolved within the concrete binding', async () => {
  await fixture({ 'backend/src/provider.rs': '#[cfg(feature="gui")] pub fn open() {}\n' }, async root => {
    const bindings = (await scan(root)).invocations!.filter(call => call.binding)
    expect(bindings).toHaveLength(1)
    expect(bindings[0]!.unresolved).toBe(true)
  }, true)
})
