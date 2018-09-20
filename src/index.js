const getServers = require('./getServers');
const ServerServerPeer = require('./ServerServerPeer');
const WebSocketClient = require('./WebSocketClient');
const inMemoryChannels = require('./inMemoryChannels');

const INITIAL_RETRY_INTERVAL = 100;
const RETRY_BACKOFF_FACTOR = 1.5;

function Hubbie() {
  this.channels = {};
  this.queues = {};
  this.serversToClose = [];
  this.listeners = {
    peer: [],
    message: []
  };
}

Hubbie.prototype = {
  listen: function(options) {
    if (options.myName) {
      inMemoryChannels.register(options.myName, this);
    }
    this.serversToClose = this.serversToClose.concat(getServers(options, this));
  },
  addClient(options) {
    if (options.peerUrl.startsWith('http')) {
      this.channels[options.peerName] = new ServerServerPeer(options, this);
    } else {
      const client = new WebSocketClient(options, this);
      client.connect();
    }
  },
  send: function(peerName, message) {
    if (!this.queues[peerName]) {
      this.queues[peerName] = [];
    }
    this.queues[peerName].push(message);
    this.trySending(peerName);
  },
  trySending: function(peerName) {
    if (this.channels[peerName]) {
      const msg = this.queues[peerName].unshift();
      this.channels[peerName].send(msg).then(() => {
        this.retryInterval[peerName] = INITIAL_RETRY_INTERVAL;
        if (this.queues[peerName].length) {
          this.trySending(peerName);
        }
      }, err => {
        this.queues[peerName].push(msg);
        setTimeout(() => this.trySending(peerName), this.retryInterval[peerName]);
        this.retryInterval[peerName] *= RETRY_BACKOFF_FACTOR;
      });
    }
  },
  on: function(eventName, handler) {
    if (!this.listeners[eventName]) {
      throw new Error('unknown eventName ' + eventName);
    }
    this.listeners[eventName].push(handler);
  },
  onPeer: function(eventObj) {
    for(let i = 0; i < this.listeners.peer.length; i++) {
      if (this.listeners.peer[i](eventObj) === false) {
        return false;
      }
    }
    return true;
  },
  onMessage: function(peerName, message) {
    for(let i = 0; i < this.listeners.peer.length; i++) {
      this.listeners.message[i](peerName, message);
    }
  },
  addChannel: function (peerName, channel) {
    this.channels[peerName] = channel;
    this.trySending(this.peerName);
  },
  removeChannel: function (peerName) {
    delete this.channels[peerName];
  }
};

module.exports = Hubbie;
