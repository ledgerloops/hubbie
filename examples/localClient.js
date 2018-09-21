const Hubbie = require('..');

localClient = new Hubbie();
localClient.addClient({
  peerName: 'bob', // for local reference only
  peerUrl: 'ws://localhost:8000',
  myName: 'alice', // for remote credentials
  mySecret: 'psst' // for remote credentials
});
localClient.send('bob', 'hi there!');

localClient.on('message', (peerName, msg) => {
  console.log(`Client sees message from ${peerName}`, msg)
});

setTimeout(() => {
  console.log('Closing client');
  localClient.close();
}, 5000);
