export function heading(label: string): HTMLElement {
  const row = document.createElement('h2')
  row.className = 'section'
  row.textContent = label
  return row
}

export function paragraph(className: string, text: string): HTMLElement {
  const row = document.createElement('p')
  row.className = className
  row.textContent = text
  return row
}
