import { Component, HostListener } from '@angular/core'

function initials(name: string): string {
  return name.slice(0, 1)
}

export const greeting = (name: string): string => `Hello ${initials(name)}`

@Component({
  selector: 'app-profile',
  templateUrl: './profile.component.html',
})
export class ProfileComponent {
  private readonly name: string

  constructor(name: string) {
    this.name = name
  }

  @HostListener('keydown.enter')
  save(): string {
    this.#reset()
    return this.label()
  }

  protected label(): string {
    return greeting(this.name)
  }

  #reset(): void {}
}
