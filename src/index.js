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
    message: [],
    error: []
  };
  this.closed = false;
}

function channelName(userName, peerName) {
  return (userName ? `${userName}/${peerName}` : peerName);
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
      this.channels[channelName(options.userName, options.peerName)] = new ServerServerPeer(options, this);
    } else {
      const client = new WebSocketClient(options, this);
      client.ensureOpen().then(openClient => { // will run in the background
        this.serversToClose.push(openClient)
      });
    }
  },
  send: function(peerName, message, userName) {
    if (!this.queues[channelName(userName, peerName)]) {
      this.queues[channelName(userName, peerName)] = [];
    }
    this.queues[channelName(userName, peerName)].push(message);
    this.trySending(channelName(userName, peerName));
  },
  trySending: function(channelName) {
   if (this.closed) {
     return;
    }
    if (this.channels[channelName] && this.queues[channelName]) {
      const msg = this.queues[channelName].shift();
      if (msg) {
        try {
          this.channels[channelName].send(msg);
        } catch (err) {
          console.error('error in trySending! requeueing', channelName, err.message);
          this.queues[channelName].push(msg);
        };
        this.retryInterval[channelName] = INITIAL_RESEND_INTERVAL;
        if (this.queues[channelName].length) {
          this.trySending(channelName);
        }
      }
    } else { // peer not created yet
      setTimeout(() => this.trySending(channelName), this.retryInterval[channelName]);
      this.retryInterval[channelName] *= RESEND_BACKOFF_FACTOR;
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
  onMessage: function(peerName, message, userName) {
    for(let i = 0; i < this.listeners.message.length; i++) {
      this.listeners.message[i](peerName, message, userName);
    }
  },
  fire: function(eventName, eventObj) {
    for(let i = 0; i < this.listeners[eventName].length; i++) {
      this.listeners[eventName][i](eventObj);
    }
  },
  addChannel: function (peerName, channel, userName) {
    this.channels[channelName(userName, peerName)] = channel;
    this.trySending(channelName(userName, peerName));
  },
  removeChannel: function (peerName, userName) {
    delete this.channels[channelName(userName, peerName)];
  },
  close: function() {
    this.closed = true;
    return Promise.resolve(this.serversToClose.map(server => server.close()));
  }
};

Hubbie.unregisterNames = inMemoryChannels.unregisterNames;

module.exports = Hubbie;
