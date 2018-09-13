const Hubbie = require('../src/hubbie')

const localClient = new Hubbie({
  name: 'localClient',
  upstreams: [
    {
      url: 'ws://localhost:8000',
      token: 'asdf'
    }
  ]
}, (peerId) => {
  console.log(`connected to ${peerId}`)
}, (obj, peerId) => {
  console.log(`client sees message from ${peerId}`, obj)
})

localClient.start()
setTimeout(() => {
  console.log('5 seconds passed, closing client again!')
  localClient.stop()
}, 5000)
