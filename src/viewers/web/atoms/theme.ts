export const paper = 0xEDE8D6
export const raised = 0xF6F2E4
export const ink = 0x26251D
export const accent = 0x1D9E75

export const kindColor = {
  person: '#B8860B',
  system: '#0B7A86',
  container: '#5C6570',
  component: '#9B3A96',
} as const

export const cssVars = `
  --paper: #EDE8D6;
  --raised: #F6F2E4;
  --ink: #26251D;
  --accent: #1D9E75;
  --person: ${kindColor.person};
  --system: ${kindColor.system};
  --container: ${kindColor.container};
  --component: ${kindColor.component};
`
