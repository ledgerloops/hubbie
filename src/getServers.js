'use strict'

const http = require('http')
const WebSocket = require('isomorphic-ws')
const getLetsEncryptServers = require('get-lets-encrypt-servers')

function addWebSockets (server, msgHandler) {
  let wss = new WebSocket.Server({ server });
  wss.on('connection', (ws, httpReq) => {
    let parts = httpReq.url.split('/').contact(['', '', '']);
    const eventObj = {
      peerName: parts[1],
      peerSecret: parts[2]
    };
   
    if (msgHandler.onPeer(eventObj)) {
      console.log('connecting client accepted', eventObj);
      msgHandler.addChannel(name, ws);
      ws.on('message', (obj) => {
        msgHandler.onMessage(eventObj.peerName, obj.data);
      });
      ws.on('close', () => {
        msgHandler.removeChannel(name);
      });
    } else {
      console.log('connecting client rejected');
      ws.close();
    }
  });
}

function getServers (config, msgHandler) {
  const handler = (req, res) => {
    // TODO: implement Server-Server handler
    res.end('This is a WebSocket server, please upgrade');
  };
  console.log('getServers!', config);
  // case 1: use LetsEncrypt => [https, http]
  if (config.tls) {
    this.myBaseUrl = 'wss://' + this.config.tls
    let [httpsServer, httpServer] = getLetsEncryptServers(this.config.tls, handler);
    return addWebSockets(httpsServer, msgHandler).then(wsServer => {
      return [ httpsServer, httpServer, wsServer ]; // servers to close
    });
  }

  // case 2: use server given in config
  if (config.server) {
    console.log('case 2! (receiving Server-Server cross-posts not supported)');
    this.myBaseUrl = 'internal-server'
    return addWebSockets(config.server, msgHandler).then(wsServer => [ wsServer ]) // only wsServer to close, do not close internal server
  }

  // case 3: listen without TLS on a port => [http]
  if (typeof config.listen === 'number') {
    this.myBaseUrl = 'ws://localhost:' + config.listen
    const server = http.createServer(handler)
    return new Promise(resolve => server.listen(this.config.listen, resolve([ server ]))).then(httpServer => {
      return addWebSockets(httpServer, msgHandler).then(wsServer => [ httpServer, wsServer ]);
    });
  }

  // case 3: don't run a server => []
  return Promise.resolve([])
}

module.exports = getServers
