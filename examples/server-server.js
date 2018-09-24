const Hubbie = require('..');
const alice = new Hubbie();
const bob = new Hubbie();
alice.listen({ port: 8081 });
bob.listen({ port: 8082 });
alice.on('peer', ({ peerName, peerSecret }) => {
  if (peerName == 'bob' && peerSecret == 'boo') {
    console.log('Accepting connection from Bob');
    return true;
  } else {
    console.log('Client rejected');
    return false;
  }
});
bob.on('peer', ({ peerName, peerSecret }) => {
  if (peerName == 'alice' && peerSecret == 'pssst') {
    console.log('Accepting connection from Alice');
    return true;
  } else {
    console.log('Client rejected');
    return false;
  }
});
alice.addClient({
  myName: 'alice',
  mySecret: 'pssst',
  peerName: 'bob',
  peerUrl: 'http://localhost:8082'
});
bob.addClient({
  myName: 'bob',
  mySecret: 'boo',
  peerName: 'alice',
  peerUrl: 'http://localhost:8081'
});
alice.on('message', (peerName, msg) => {
  console.log(`Alice sees message from ${peerName}`, msg)
});
bob.on('message', (peerName, msg) => {
  console.log(`Bob sees message from ${peerName}`, msg)
});
alice.send('bob', 'Hello Bob!');
bob.send('alice', 'Hello Alice!');

setTimeout(() => {
  console.log('Closing servers');
  alice.close();
  bob.close();
}, 1000);
