export {}

const owner = 'src/viewers/web/atoms/chrome.ts'
const scrollbarRule = /scrollbar-(?:width|color)|::-webkit-scrollbar/
const violations: string[] = []

for await (const file of new Bun.Glob('src/viewers/web/**/*.ts').scan('.')) {
  const normalized = file.replaceAll('\\', '/')
  if (normalized === owner) continue
  if (scrollbarRule.test(await Bun.file(file).text())) violations.push(normalized)
}

if (violations.length > 0) {
  console.error(`Web scrollbar CSS belongs only in ${owner}:\n${violations.join('\n')}`)
  process.exit(1)
}
