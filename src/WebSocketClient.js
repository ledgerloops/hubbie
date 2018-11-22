const WebSocket = require('isomorphic-ws')

const INITIAL_RECONNECT_INTERVAL = 100;
const RECONNECT_BACKOFF_FACTOR = 1.5;

function WebSocketClient(options, msgHandler) {
  this.myName = options.myName;
  this.mySecret = options.mySecret;
  this.peerName = options.peerName;
  this.peerUrl = options.peerUrl;
  this.protocols = options.protocols;
  this.msgHandler = msgHandler;
  this.incarnations = 0;
  this.tryingToOpen = false;
  this.hasBeenOpen = false;
  this.shouldClose = false;
  this.reconnectInterval = INITIAL_RECONNECT_INTERVAL;
}

WebSocketClient.prototype = {
  connect: function (whenConnected) {
    return new Promise((resolve, reject) => {
      const wsUrl = this.peerUrl + '/' + this.myName + '/' + this.mySecret
      const ws = new WebSocket(wsUrl, this.protocols)
      ws.incarnation = ++this.incarnations
      ws.onopen = () => {
        this.hasBeenOpen = true;
        this.reconnectInterval = INITIAL_RECONNECT_INTERVAL;
        whenConnected(ws);
        resolve(ws);
      }
      ws.onerror = (err) => {
        reject(err);
      };
      ws.onclose = () => {

        if (this.hasBeenOpen && !this.shouldClose && !ws.thisWsShouldClose) {
          this.reconnectInterval *= RECONNECT_BACKOFF_FACTOR
          if (!this.tryingToOpen) {
            setTimeout(() => {
              this.ensureOpen()
            }, this.reconnectInterval);
          }
        }
      }
    }).catch((err) => { // ignore
    }); // eslint-disable-line handle-callback-err
  },

  connectRetry: function (whenConnected) {
    return new Promise((resolve) => {
      let done = false
      const tryOnce = () => {
        this.connect((ws) => {
          if (done) { // this can happen if opening the WebSocket works, but just takes long
            ws.thisWsShouldClose = true
            ws.close()
          } else {
            done = true
            clearInterval(timer)
            whenConnected(ws);
            resolve(ws)
          }
        });
      }
      let timer
      const tryAgain = () => {
        timer = setTimeout(() => {
          tryOnce()
          this.reconnectInterval *= RECONNECT_BACKOFF_FACTOR
          tryAgain()
        }, this.reconnectInterval)
      }
      tryOnce()
      tryAgain()
    })
  },

  ensureOpen: function () {
    if (!this.tryingToOpen) {
      this.tryingToOpen = true;
      this.whenOpen = this.connectRetry((ws) => {
        this.tryingToOpen = false;
        ws.onmessage = (msg) => {
          this.msgHandler.onMessage(this.peerName, msg.data);
        }
        this.msgHandler.addChannel(this.peerName, {
          send: (msg) => {
            ws.send(msg);
            return Promise.resolve();
          }
        });
      }).then((ws) => {
        return {
          close: () => {
            this.shouldClose = true;
            ws.close();
            return Promise.resolve();
          }
        };
      }, (err) => {
        return { close: () => Promise.resolve() };
      });
    }
    return this.whenOpen;
  }
};
 
module.exports = WebSocketClient;
