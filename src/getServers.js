'use strict'

const http = require('http')
const WebSocket = require('isomorphic-ws')
const getLetsEncryptServers = require('get-lets-encrypt-servers')

function addWebSockets (server, msgHandler) {
  let wss = new WebSocket.Server({ server });
  wss.on('connection', (ws, httpReq) => {
    let parts = httpReq.url.split('/').concat(['', '', '']);
    const eventObj = {
      peerName: parts[1],
      peerSecret: parts[2]
    };
   
    if (msgHandler.onPeer(eventObj)) {
      msgHandler.addChannel(eventObj.peerName, ws);
      ws.on('message', (msg) => {
console.log('ws on message!', msg);
        msgHandler.onMessage(eventObj.peerName, msg);
      });
      ws.on('close', () => {
        msgHandler.removeChannel(eventObj.peerName);
      });
    } else {
      ws.close();
    }
  });
  return {
    close: () => {
      console.log('closing wss!');
      wss.close();
      console.log('wss closed!');
    }
  };
}

function getServers (config, msgHandler) {
  const handler = (req, res) => {
    // TODO: implement Server-Server handler
    res.end('This is a WebSocket server, please upgrade');
  };
  // case 1: use LetsEncrypt => [https, http]
  if (config.tls) {
    return getLetsEncryptServers(this.config.tls, handler).then(([httpsServer, httpServer]) => {
      const wsServer = addWebSockets(httpsServer, msgHandler);
      return [ httpsServer, httpServer, wsServer ]; // servers to close
    });
  }

  // case 2: use server given in config
  if (config.server) {
    return Promise.resolve([ addWebSockets(config.server, msgHandler) ]); // only wsServer to close, do not close internal server
  }

  // case 3: listen without TLS on a port => [http]
  if (typeof config.port === 'number') {
    const httpServer = http.createServer(handler)
    return new Promise(resolve => httpServer.listen(config.port, resolve)).then(() => {
      const wsServer = addWebSockets(httpServer, msgHandler);
      return [ {
        close: () => {
          console.log('closing http server!');
          httpServer.close();
          console.log('httpServer closed!');
        }
      }, wsServer ];
    });
  }

  // case 3: don't run a server => []
  return Promise.resolve([])
}

module.exports = getServers
