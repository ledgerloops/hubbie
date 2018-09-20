const WebSocket = require('isomorphic-ws')

function WebSocketClient(options, msgHandler) {
  this.myName = options.myName;
  this.mySecret = options.mySecret;
  this.peerName = options.peerName;
  this.peerUrl = options.peerUrl;
  this.msgHandler = msgHandler;
  this.incarnations = 0;
}

WebSocketClient.prototype = {
  connect: function () {
    return new Promise((resolve, reject) => {
      const wsUrl = this.peerUrl + '/' + this.myName + '/' + this.mySecret
      const ws = new WebSocket(wsUrl)
      this.hasBeenOpen = false
      this.shouldClose = false
      ws.incarnation = ++this.incarnations
      ws.onopen = () => {
        ws.hasBeenOpen = true
        resolve(ws);
      }
      ws.onerror = reject
      ws.onclose = () => {
        if (ws.hasBeenOpen && !this.peers[peerId].shouldClose) {
          this.ensureOpen()
        }
      }
    })
  },

  connectRetry: function () {
    return new Promise((resolve) => {
      let done = false
      const tryOnce = () => {
        this.connect().then(ws => {
          if (done) { // this can happen if opening the WebSocket works, but just takes long
            ws.shouldClose = true
            ws.close()
          } else {
            done = true
            clearInterval(timer)
            resolve(ws)
          }
        }).catch((err) => {}) // eslint-disable-line handle-callback-err
      }
      let timer = setInterval(tryOnce, CONNECT_RETRY_INTERVAL)
      tryOnce()
    })
  },

  ensureOpen: function () {
    return this.connectRetry().then(ws => {
      ws.onmessage = (msg) => {
        this.msgHandler.onMessage(this.peerName, msg.data);
      }
      this.msgHandler.addChannel(this.peerName, ws);
      ws.on('close', () => {
        msgHandler.removeChannel(name);
      });
    }, (err) => {}) // eslint-disable-line handle-callback-err
  }
};
 
module.exports = WebSocketClient;
