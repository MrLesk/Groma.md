import { Component, memo } from 'react'

function initials(name: string): string {
  return name.slice(0, 1)
}

export const Avatar = ({ name }: { name: string }) => <span>{initials(name)}</span>

export function Profile({ name }: { name: string }) {
  return <Avatar name={name} />
}

export const Badge = memo(({ label }: { label: string }) => <em>{label}</em>)

export class Counter extends Component<{ start: number }> {
  static label(): string {
    return 'Counter'
  }

  protected increment(): void {}

  render() {
    return <button type="button" onClick={() => this.increment()}>{Counter.label()}</button>
  }
}
