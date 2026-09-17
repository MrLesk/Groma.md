function hidden(): string {
  return 'hidden'
}

function listed(): string {
  return hidden()
}

export class Service {
  private readonly label: string

  constructor(label: string) {
    this.label = label
  }

  describe(): string {
    return this.label
  }
}

export interface Store {
  read(): string
  write: (value: string) => void
}

export declare enum Mode {
  On,
}

export type Alias = Service

export declare namespace Registry {
  export function lookup(name: string): Service
}

export { listed }
