# Hubbie
Manager for WebSocket server and clients

Hubbie can be configured to act as one WebSocket server and/or one or multiple WebSocket clients.
It takes care of reconnecting clients when the server restarts, and queueing up messages until they can be sent.
It can also register a TLS certificate registration for you, or run on localhost.
Apart from WebSocket server and WebSocket client, it can act as http cross-posting peer,
or as a hub for in-process messaging, which is nice when are testing your multi-agent messaging, or simulating a network.

## Creating a local server:

See `examples/local.js`

```js
const Hubbie = require('.')

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
```

## Creating a client:

See `examples/local.js`

```js
localClient = new Hubbie();
localClient.addClient({
  myName: 'localClient',
  peerUrl: 'ws://localhost:8000',
  mySecret: 'asdf'
});
localClient.on('message', (peerId, msg) => {
  console.log(`client sees message from ${peerId}`, msg)
});
```

## Sending and receiving messages

Start an interactive node REPL,
```sh
$ node
>
```

Now paste the two snippets above into it, and then run:

```js
> localClient.send('ws://localhost:8000/localClient/asdf', 'hello')
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
new Hubbie({ tls: 'ws.example.com' }, (peerId) => {}, (obj, peerId) => {})
```
