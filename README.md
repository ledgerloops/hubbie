# Hubbie
Manager for WebSocket server and clients

Hubbie can be configured to act as one WebSocket server and/or one or multiple WebSocket clients.
It takes care of reconnecting clients when the server restarts, and resending WebSocket messages that
were not yet responded to. It can also register a TLS certificate registration for you, or run
on localhost.

Its constructor takes three arguments:
* config
  * `listen`: `<Number>` On localhost, port to listen on. You can specify `listen`, or `tls`, or neither, but not both.
  * `tls`: On a server, domain name to register a LetsEncrypt certificate for. You can specify `listen`, or `tls`, or neither, but not both.
  * `upstreams`: `<Array of Object>`
    * `url`: `<String>` The base URL of the server. Should start with either `ws://` or `wss://` and should not end in a `/`.
    * `token`: `<String>` The token for connecting to this upstream.
  * `name`: `<String>` Required if `upstreams` is non-empty; used to determine the WebSocket URL when connecting to upstreams 
* connectionCallback
  * @param `peerId`: `<String>` Full URL of the WebSocket connection, e.g. `'ws://localhost:8000/name/token'`
* messageCallback
  * @param `obj`: `<Object>` Result of `JSON.parse` of the message that was received.
  * @param `peerId`: `<String>` Full URL of the WebSocket connection, e.g. `'ws://localhost:8000/name/token'`

There is are two methods, `send`, to send a message to one of the Spider's peers:
* @param `obj`: `<Object>` Object that will be passed to `JSON.stringify` to create the message.
* @param `peerId`: `<String>` URL of the upstream or downstream peer to which the packet should be sent.
* @param `repeaterId`: `<String or Number, non-falsy>` identifier under which this request should be repeated.
* @returns `<Promise>.<null>`

and `stopRepeating` (call this when you have received and process and answer):
* @param `repeaterId`: `<String or Number, non-falsy>` identifier of request for which repeat sending should stop.

## Creating a local server:

See `examples/localServer.js`

```js
const Hubbie = require('./src/spider')
localServer = new Hubbie({
  listen: 8000
}, (peerId) => {
  console.log(`somebody connected on ${peerId}`)
}, (obj, peerId) => {
  console.log(`server sees message from ${peerId}`, obj)
})
```

## Creating a client:

See `examples/localServer.js`

```js
localClient = new Hubbie({
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
```

## Sending and receiving messages

Start an interactive node REPL,
```sh
$ node
>
```

Now paste the two snippets above into it, and then run:

```js
> localClient.start()
Promise { <pending> }
> localServer.start()
Promise { <pending> }
> somebody connected on ws://localhost:8000/localClient/asdf
connected to ws://localhost:8000/localClient/asdf

> localClient.send({ type: 1, requestId: 1, data: { protocolData: [] } }, 'ws://localhost:8000/localClient/asdf', 1)
undefined
> server sees message from ws://localhost:8000/localClient/asdf { type: 1, requestId: 1, data: [] }
> localClient.stopRepeating(1)
undefined
> localServer.stop()
Promise { <pending> }
> localClient.stop()
Promise { <pending> }
>
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
