// Another file may assign any field of this class, so a field the file assigns is unknown, while one it
// never assigns, such as one a framework injects, is the client's own base setting.
export class TalksClient {
  base = '/api'

  load() {
    return fetch(this.base + '/talks')
  }

  loadInjected() {
    return fetch(this.injected + '/talks')
  }
}
