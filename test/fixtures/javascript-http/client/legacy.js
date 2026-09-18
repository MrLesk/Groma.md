function reportTalks(id) {
  // A `$` this file declares is not jQuery, and a URL passed to another function is not a request.
  const $ = document.querySelector.bind(document)
  $.get('/api/talks')
  log('/api/talks/' + id)

  var local = fetch
  return local
}

function fetch(url) {
  return url
}

function log(value) {
  return value
}
