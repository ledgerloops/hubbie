'use strict'

const http = require('http')
const WebSocket = require('isomorphic-ws')
const getLetsEncryptServers = require('get-lets-encrypt-servers')

function checkCreds(url, msgHandler, multiUser = false) {
  let parts = url.split('/').concat(['', '', '']);
  let eventObj;
  if (multiUser)  {
    eventObj = {
      userName: parts[1],
      peerName: parts[2],
      peerSecret: parts[3]
    };
  } else {
    eventObj = {
      peerName: parts[1],
      peerSecret: parts[2]
    };
  }
  return msgHandler.onPeer(eventObj).then((verdict) => {
    if (verdict) {
      return eventObj;
    }
  });
}

function addWebSockets (server, msgHandler, protocolName, multiUser = false) {
  const handleProtocols = (protocols, httpReq) => {
    if (protocols.indexOf(protocolName) === -1) {
      return false;
    }
   return protocolName;
  };
  let wss = new WebSocket.Server({ server, handleProtocols });
  wss.on('connection', (ws, httpReq) => {
    // using this instead of the verifyClient option
    // from https://github.com/websockets/ws/blob/HEAD/doc/ws.md
    // because this way we have peerName available here for the addChannel call:
    checkCreds(httpReq.url, msgHandler, multiUser).then((eventObj) => {
      if (eventObj) {
        const { peerName, userName } = eventObj;
        msgHandler.addChannel(peerName, ws, userName);
        ws.on('message', (msg) => {
          msgHandler.onMessage(peerName, msg, userName);
        });
        ws.on('close', () => {
          msgHandler.removeChannel(peerName, userName);
        });
      } else {
        msgHandler.fire('error', new Error('wrong creds'));
        ws.close();
      }
    });
  });
  return wss;
}

function getServers (config, msgHandler) {
  const credsCache = {};
  const handler = (req, res) => {
    if (req.method === 'POST') {
      checkCreds(req.url, msgHandler, config.multiUser).then((eventObj) => {
        if (eventObj) {
          const { peerName, userName } = eventObj;
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });
          req.on('end', () => {
            msgHandler.onMessage(peerName, body, userName);
            res.end('');
          });
        } else {
          msgHandler.fire('error', new Error('wrong creds'));
          res.end('unknown peer name/secret');
        }
      });
    } else if (config.handler) {
      config.handler(req, res);
    } else {
      res.end('This is a Hubbie server, please use WebSocket or POST requests');
    }
  };
  // case 1: use LetsEncrypt => [https, http]
  if (config.tls) {
    return getLetsEncryptServers(config.tls, handler).then(([httpsServer, httpServer]) => {
      const wsServer = addWebSockets(httpsServer, msgHandler, config.protocolName, config.multiUser);
      return [ httpsServer, httpServer, wsServer ]; // servers to close
    });
  }

  // case 2: use server given in config
  if (config.server) {
    return Promise.resolve([ addWebSockets(config.server, msgHandler, config.protocolName, config.multiUser) ]); // only wsServer to close, do not close internal server
  }

  // case 3: listen without TLS on a port => [http]
  if (typeof config.port === 'number') {
    const httpServer = http.createServer(handler)
    return new Promise(resolve => httpServer.listen(config.port, resolve)).then(() => {
      const wsServer = addWebSockets(httpServer, msgHandler, config.protocolName, config.multiUser);
      return [ httpServer, wsServer ];
    });
  }

  // case 3: don't run a server => []
  return Promise.resolve([])
}

module.exports = getServers
