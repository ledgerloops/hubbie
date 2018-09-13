const Hubbie = require('../src/hubbie')

const localServer = new Hubbie({
  listen: 8000
}, (peerId) => {
  console.log(`somebody connected on ${peerId}`)
}, (obj, peerId) => {
  console.log(`server sees message from ${peerId}`, obj)
})

localServer.start()
setTimeout(() => {
  console.log('10 seconds passed, closing server again!')
  localServer.stop()
}, 10000)
