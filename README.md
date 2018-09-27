# Hubbie
Manager for WebSocket server and clients

## Why?
WebSocket client objects take a URL in their constructor, and then live through only one cycle of open/close.
This may be fine for short-lived web pages that get refreshed soon enough, but for long-lived contexts
such as [unhosted web apps](https://unhosted.org) or browser extensions, it's more useful to have a client object
that represents multiple incarnations of a WebSocket, makes sure it opens a new incarnation when necessary,
and always sends message to the latest incarnation.

## What else?
Hubbie:
* takes care of reconnecting clients when the server restarts
* queues up messages until they can be sent
* can be used as one or multiple WebSocket clients
* or as a hub for in-process messaging, which is nice when are testing your multi-agent messaging, or simulating a network


And when used in node, Hubbie can also:
* be configured to act as one WebSocket server
* register a TLS certificate registration for you, or run on localhost.
* act as http cross-posting peer (useful to transparently optimize the communication when both sender and receiver are servers)

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

## Running two Hubbies in Server-Server configuration
Here, instead of using a WebSocket server and a WebSocket client, both Hubbies run a http server and a http client. To send a message to the other Hubbie, they do a http post. This setup is not compatible with `Hubbie#listen({ server })`, since Hubbie will not interfere with the POST handler of the existing http server you give it. So please either use `Hubbie#listen({ port })` or `Hubbie#listen({ tls })` instead.

The `'peer'` event will be triggered the first time a message from a new peer is received. If you don't return `false` from any handler of this event, all subsequent POSTs that use that `peerName` and `peerSecret` in the URL will trigger a `'message'` event.

```js
const Hubbie = require('.');
const alice = new Hubbie();
const bob = new Hubbie();
alice.listen({ port: 8081 });
bob.listen({ port: 8082 });
alice.on('peer', ({ peerName, peerSecret }) => {
  if (peerName == 'bob' && peerSecret == 'boo') {
    console.og('Accepting connection from Bob');
    return true;
  } else {
    console.log('Client rejected');
    return false;
  }
});
bob.on('peer', ({ peerName, peerSecret }) => {
  if (peerName == 'alice' && peerSecret == 'pssst') {
    console.og('Accepting connection from Alice');
    return true;
  } else {
    console.log('Client rejected');
    return false;
  }
});
alice.addClient({
  myName: 'alice',
  mySecret: 'pssst'
  peerName: 'bob',
  peerUrl: 'http://localhost:8082'
});
bob.addClient({
  myName: 'bob',
  mySecret: 'boo'
  peerName: 'alice',
  peerUrl: 'http://localhost:8081'
});
alice.on('message', (peerName, msg) => {
  console.log(`Alice sees message from ${peerName}`, msg)
});
alice.on('message', (peerName, msg) => {
  console.log(`Alice sees message from ${peerName}`, msg)
});
alice.send('bob', 'Hello Bob!');
bob.send('alice', 'Hello Alice!');

setTimeout(() => {
  console.log('Closing servers');
  alice.close();
  bob.close();
}, 10000);
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

