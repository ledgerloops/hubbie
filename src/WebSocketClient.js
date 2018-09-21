const WebSocket = require('isomorphic-ws')

const INITIAL_RECONNECT_INTERVAL = 100;
const RECONNECT_BACKOFF_FACTOR = 1.5;

function WebSocketClient(options, msgHandler) {
  this.myName = options.myName;
  this.mySecret = options.mySecret;
  this.peerName = options.peerName;
  this.peerUrl = options.peerUrl;
  this.msgHandler = msgHandler;
  this.incarnations = 0;
  this.hasBeenOpen = false;
  this.shouldClose = false;
}

WebSocketClient.prototype = {
  connect: function () {
    return new Promise((resolve, reject) => {
      const wsUrl = this.peerUrl + '/' + this.myName + '/' + this.mySecret
      const ws = new WebSocket(wsUrl)
      ws.incarnation = ++this.incarnations
      ws.onopen = () => {
        this.hasBeenOpen = true;
        resolve(ws);
      }
      ws.onerror = reject
      ws.onclose = () => {
        if (this.hasBeenOpen && !this.shouldClose && !ws.thisWsShouldClose) {
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
            ws.thisWsShouldClose = true
            ws.close()
          } else {
            done = true
            clearInterval(timer)
            resolve(ws)
          }
        }).catch((err) => {
          // console.error('error connection websocket incarnation!', err.message);
        }) // eslint-disable-line handle-callback-err
      }
      let reconnectInterval = INITIAL_RECONNECT_INTERVAL
      let timer
      function tryAgain() {
        timer = setTimeout(() => {
          tryOnce()
          reconnectInterval *= RECONNECT_BACKOFF_FACTOR
          tryAgain()
        }, reconnectInterval)
      }
      tryOnce()
      tryAgain()
    })
  },

  ensureOpen: function () {
    return this.connectRetry().then(ws => {
      ws.onmessage = (msg) => {
        this.msgHandler.onMessage(this.peerName, msg.data);
      }
      this.msgHandler.addChannel(this.peerName, {
        send: (msg) => {
          ws.send(msg);
          return Promise.resolve();
        }
      });
      return {
        close: () => {
          this.shouldClose = true;
          ws.close();
          return Promise.resolve();
        }
      };
    }, (err) => {
      console.error('failed! this should never be reached', err.message);
      return { close: () => Promise.resolve() };
    });
  }
};
 
module.exports = WebSocketClient;
