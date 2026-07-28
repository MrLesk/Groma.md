export function createReloadStatus() {
  let error = null

  return {
    get error() {
      return error
    },
    recordModelFailure(message) {
      error = message
    },
    recordModelSuccess() {
      error = null
    },
  }
}
