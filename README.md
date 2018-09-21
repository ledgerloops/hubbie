# Hubbie
Manager for WebSocket server and clients

Hubbie can be configured to act as one WebSocket server and/or one or multiple WebSocket clients.
It takes care of reconnecting clients when the server restarts, and queueing up messages until they can be sent.
It can also register a TLS certificate registration for you, or run on localhost.
Apart from WebSocket server and WebSocket client, it can act as http cross-posting peer,
or as a hub for in-process messaging, which is nice when are testing your multi-agent messaging, or simulating a network.

## Creating a local server:

See `examples/localServer.js`

```js
const Hubbie = require('.');
const userCredentials = {
  alice: 'psst'
};
localServer = new Hubbie();
localServer.listen({
  port: 8000
});

localServer.on('peer', (eventObj) => {
  if (eventObj.peerSecret === userCredentials[eventObj.peerName]) {
    console.log('Accepting connection', eventObj);
    localServer.send(eventObj.peerName, 'Welcome!');
    return true;
  } else {
    console.log('Client rejected');
    return false;
  }
});
localServer.on('message', (peerName, msg) => {
  console.log(`Server sees message from ${peerName}`, msg)
});
setTimeout(() => {
  console.log('Closing server');
  localServer.close();
}, 10000);
```

## Creating a client:

See `examples/localClient.js`

```js
const Hubbie = require('.');

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
```

## Running multiple agents in the same process

When agents run in the same process, there is no need for them to connect over a WebSocket. Hubbie allows them to listen on a name:

```sh
const Hubbie = require('.')

const alice = new Hubbie();
alice.listen({ myName: 'alice' });

const bob = new Hubbie();
bob.listen({ myName: 'bob' });

alice.send('bob', 'Hello Bob!');

bob.on('message', (peerName, msg) => {
  console.log(`Bob sees message from ${peerName}`, msg)
});
```

## Built-in LetsEncrypt registration

If instead of `listen` you specify `tls`, the server will listen for secure WebSockets on port 443.
This will not work on your laptop, or on a PaaS service like Heroku; you need a server (VPS) with
its own IPv4 address, and make sure 'ws.example.com' points to your server and DNS has propagated.

Then, SSH into your server:

```sh
ssh root@ws.example.com
```

Then run this node script:

```js
const a = new Hubbie();
a.listen({ tls: 'ws.example.com' });
```

