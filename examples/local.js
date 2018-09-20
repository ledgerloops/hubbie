const Hubbie = require('..')

localServer = new Hubbie();
localServer.listen({
  port: 8000
});
localServer.on('peer', (peerId) => {
  console.log(`somebody connected on ${peerId}`)
});
localServer.on('message', (peerId, msg) => {
  console.log(`server sees message from ${peerId}`, msg)
});

localClient = new Hubbie();
localClient.addClient({
  myName: 'localClient',
  peerUrl: 'ws://localhost:8000',
  mySecret: 'asdf'
});
localClient.on('message', (peerId, msg) => {
  console.log(`client sees message from ${peerId}`, msg)
});

localClient.send('ws://localhost:8000/localClient/asdf', 'hello')
