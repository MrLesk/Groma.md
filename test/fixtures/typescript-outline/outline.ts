function hidden(): string {
  return 'hidden'
}

function listed(): string {
  return hidden()
}

function overloaded(value: string): string
function overloaded(value: number): number
function overloaded(value: string | number): string | number {
  return value
}

// biome-ignore lint/complexity/useArrowFunction: the outline lists a function expression bound to a name.
const described = function (): string {
  return overloaded('described')
}

export class Service {
  private readonly label: string

  constructor(label: string) {
    this.label = label
  }

  describe(): string {
    this.reset()
    return this.label
  }

  'save'(): string {
    return this.label
  }

  404(): string {
    return this.label
  }

  private reset(): void {}

  get size(): number {
    return this.label.length
  }
}

export interface Store {
  read(): string
  "fetch"(): string
  write: (value: string) => void
}

export declare enum Mode {
  On,
}

export type Alias = Service

export declare namespace Registry {
  export function lookup(name: string): Service
}

export declare namespace Tools.Text {
  export function trim(value: string): string
}

// The file's export list names `listed`, but not this namespace member.
export namespace Shapes {
  interface listed {
    area(): number
  }
  export type Area = listed
}

export { listed }
export default described
