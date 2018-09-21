const Hubbie = require('..')

const alice = new Hubbie();
alice.listen({ myName: 'alice' });

const bob = new Hubbie();
bob.listen({ myName: 'bob' });

alice.send('bob', 'Hello Bob!');

bob.on('message', (peerName, msg) => {
  console.log(`Bob sees message from ${peerName}`, msg)
});
