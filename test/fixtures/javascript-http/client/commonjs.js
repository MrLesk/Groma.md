const client = require('axios')
let replaced = require('axios')

client.defaults.baseURL = process.env.API_URL
replaced = { get: async path => path }

// The one assignment to the client's defaults sets its base; a required client the file assigns
// again is no longer the client.
function loadRequired() {
  client.get('/required')
  replaced.get('/replaced')
}

module.exports = { loadRequired }
