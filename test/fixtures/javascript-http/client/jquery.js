function loadRooms(id, method) {
  $.get('/files')
  $.post('/submissions', { id: id })
  $.getJSON('/talks/' + id)
  $.getScript('/scripts/app.js')
  jQuery.ajax({ url: '/api/talks', type: 'POST' })
  // jQuery prefers `method` to its older `type`.
  $.ajax({ url: '/api/method', type: 'GET', method: 'PATCH' })
  $.ajax('/status', { type: 'DELETE' })

  // Settings without a method are a GET, and a URL the source does not prove stays computed.
  $.ajax({ url: '/api/default' })
  $.get(urlFor(id))

  // An unresolved method omits it, and settings the scanner cannot read state no method or URL.
  $.ajax({ url: '/api/rooms', type: method })
  $.ajax(settingsFor(id))
  $.ajax('/api/rooms', settingsFor(id))
}

function settingsFor(id) {
  return { type: 'PUT', data: { id: id } }
}

function urlFor(id) {
  return `/rooms/${id}`
}
