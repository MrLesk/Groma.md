let base = '/api'
const config = { talks: '/api/talks' }

function loadGlobals() {
  fetch(base + '/talks')
  fetch(config.talks)
}
