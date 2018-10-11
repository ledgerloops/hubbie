const getServers = require('./getServers');
const ServerServerPeer = require('./ServerServerPeer');
const WebSocketClient = require('./WebSocketClient');
const inMemoryChannels = require('./inMemoryChannels');

const INITIAL_RESEND_INTERVAL = 100;
const RESEND_BACKOFF_FACTOR = 1.5;

function Hubbie() {
  this.channels = {};
  this.queues = {};
  this.retryInterval = {};
  this.serversToClose = [];
  this.listeners = {
    peer: [],
    message: []
  };
  this.closed = false;
}

Hubbie.prototype = {
  listen: function(options) {
    if (options.myName) {
      this.serversToClose.push(inMemoryChannels.register(options.myName, this));
      return Promise.resolve();
    }
    return getServers(options, this).then((servers) => {
      this.serversToClose = this.serversToClose.concat(servers);
    });
  },
  addClient(options) {
    if (options.peerUrl.substr(-1) == '/') {
      options.peerUrl = options.peerUrl.substring(0, options.peerUrl.length-1);
    }
    if (options.peerUrl.startsWith('http')) {
      this.channels[options.peerName] = new ServerServerPeer(options, this);
    } else {
      const client = new WebSocketClient(options, this);
      client.ensureOpen().then(openClient => { // will run in the background
        this.serversToClose.push(openClient)
      });
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
   if (this.closed) {
     return;
    }
    if (this.channels[peerName] && this.queues[peerName]) {
      const msg = this.queues[peerName].shift();
      if (msg) {
        try {
          this.channels[peerName].send(msg);
        } catch (err) {
          console.error('error in trySending! requeueing', peerName, err.message);
          this.queues[peerName].push(msg);
        };
        this.retryInterval[peerName] = INITIAL_RESEND_INTERVAL;
        if (this.queues[peerName].length) {
          this.trySending(peerName);
        }
      }
    } else { // peer not created yet
      setTimeout(() => this.trySending(peerName), this.retryInterval[peerName]);
      this.retryInterval[peerName] *= RESEND_BACKOFF_FACTOR;
    }
  },
  on: function(eventName, handler) {
    if (!this.listeners[eventName]) {
      throw new Error('unknown eventName ' + eventName);
    }
    this.listeners[eventName].push(handler);
  },
  onPeer: function (eventObj) {
    const promises = [];
    for (let i = 0; i < this.listeners.peer.length; i++) {
      promises.push(this.listeners.peer[i](eventObj));
    }
    return Promise.all(promises).then(results => {
      for(let i = 0; i < results.length; i++) {
        if (results[i] === false) {
          return false;
        }
      }
      return true;
    });
  },
  onMessage: function(peerName, message) {
    for(let i = 0; i < this.listeners.message.length; i++) {
      this.listeners.message[i](peerName, message);
    }
  },
  addChannel: function (peerName, channel) {
    this.channels[peerName] = channel;
    this.trySending(peerName);
  },
  removeChannel: function (peerName) {
    delete this.channels[peerName];
  },
  close: function() {
    this.closed = true;
    return Promise.resolve(this.serversToClose.map(server => server.close()));
  }
};

module.exports = Hubbie;
