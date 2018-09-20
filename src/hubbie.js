'use strict'

const http = require('http')
const WebSocket = require('isomorphic-ws')
const getLetsEncryptServers = require('get-lets-encrypt-servers')

const PEER_TYPE_DOWNSTREAM = 'downstream'
const PEER_TYPE_UPSTREAM = 'upstream'

const CONNECT_RETRY_INTERVAL = 10000
const SEND_RETRY_INTERVAL = 100
const PING_INTERVAL = 50000 // keep heroku dyno alive

function Hubbie (config, connectHandler, msgHandler) {
  this.peers = {}
  this.serversToClose = []
  this.config = config
  this.connectHandler = connectHandler
  this.msgHandler = msgHandler
  this.incarnations = {}
  // this.myBaseUrl
}

Hubbie.prototype = {
  getServers () {
    const handler = (req, res) => {
      res.end('This is a WebSocket server, please upgrade');
    };
    console.log('getServers!', this.config);
    // case 1: use LetsEncrypt => [https, http]
    if (this.config.tls) {
      this.myBaseUrl = 'wss://' + this.config.tls
      return getLetsEncryptServers(this.config.tls, handler);
    }

    // case 2: use server given in config
    if (this.config.server) {
      console.log('case 2!');
      this.myBaseUrl = 'internal-server'
      return Promise.resolve([ this.config.server ])
    }

    // case 3: don't run a server => []
    if (typeof this.config.listen !== 'number') {
      return Promise.resolve([])
    }

    // case 4: listen without TLS on a port => [http]
    this.myBaseUrl = 'ws://localhost:' + this.config.listen
    const server = http.createServer(handler)

    return new Promise(resolve => server.listen(this.config.listen, resolve([ server ])))
  },

  maybeListen () {
    return this.getServers().then(servers => {
      this.serversToClose = servers
      if (servers.length) {
        this.wss = new WebSocket.Server({ server: servers[0] })
        this.serversToClose.push(this.wss)
        this.wss.on('connection', (ws, httpReq) => {
          const peerId = this.myBaseUrl + httpReq.url
          if (this.peers[peerId]) {
            this.peers[peerId].ws = ws
            // FIXME: https://github.com/interledgerjs/btp-toolbox/issues/5
            setTimeout(() => {
              for (let repeaterId in this.peers[peerId].unanswered) {
                this.send(this.peers[peerId].unanswered[repeaterId], peerId)
              }
            }, 100)
          } else {
            this.peers[peerId] = {
              type: PEER_TYPE_DOWNSTREAM,
              unanswered: {},
              ws
            }
          }
          setInterval(() => {
            ws.send('ping');
          }, PING_INTERVAL);
          ws.on('message', (msg) => {
            const obj = JSON.parse(msg)
            this.msgHandler(obj, peerId)
          })
          this.connectHandler(peerId)
        })
      }
    })
  },

  connectToUpstream (peerId) {
    return new Promise((resolve, reject) => {
      const ws = new WebSocket(peerId)
      ws.hasBeenOpen = false
      ws.shouldClose = false
      ws.incarnation = ++this.incarnations[peerId]
      ws.onopen = () => {
        ws.hasBeenOpen = true
        resolve(ws)
      }
      ws.onerror = reject
      ws.onclose = () => {
        if (ws.hasBeenOpen && !this.peers[peerId].shouldClose) {
          this.ensureUpstream(peerId)
        }
      }
    })
  },

  connectToUpstreamRetry (peerId) {
    return new Promise((resolve) => {
      let done = false
      const tryOnce = () => {
        this.connectToUpstream(peerId).then(ws => {
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

  ensureUpstream (peerId) {
    return this.connectToUpstreamRetry(peerId).then(ws => {
      ws.onmessage = (msg) => {
        const obj = JSON.parse(msg.data)
        this.msgHandler(obj, peerId)
      }
      if (this.peers[peerId]) {
        this.peers[peerId].ws = ws
        for (let repeaterId in this.peers[peerId].unanswered) {
          this.send(this.peers[peerId].unanswered[repeaterId], peerId)
        }
      } else {
        this.peers[peerId] = {
          type: PEER_TYPE_UPSTREAM,
          unanswered: {},
          ws
        }
      }
      this.connectHandler(peerId)
    }, (err) => {}) // eslint-disable-line handle-callback-err
  },

  addUpstream (upstreamConfig) {
    const peerId = upstreamConfig.url + '/' + this.config.name + '/' + upstreamConfig.token
    this.incarnations[peerId] = 0
    return this.ensureUpstream(peerId)
  },

  connectToUpstreams () {
    if (!Array.isArray(this.config.upstreams)) {
      return Promise.resolve()
    }
    return Promise.all(this.config.upstreams.map(upstreamConfig => {
      return this.addUpstream(upstreamConfig)
    }))
  },

  start () {
    return Promise.all([
      this.maybeListen(),
      this.connectToUpstreams()
    ])
  },

  stop () {
    // close ws/wss clients:
    let promises = Object.keys(this.peers).map(peerId => {
      this.peers[peerId].unanswered = {}
      if (this.peers[peerId].type === PEER_TYPE_DOWNSTREAM) {
        return Promise.resolve()
      }
      return new Promise(resolve => {
        this.peers[peerId].shouldClose = true
        this.peers[peerId].ws.on('close', () => {
          resolve()
        })
        this.peers[peerId].ws.close()
      })
    })

    // close http, https, ws/wss servers:
    promises.push(this.serversToClose.map(server => {
      return new Promise((resolve) => {
        server.close(resolve)
      })
    }))
    return Promise.all(promises)
  },

  send (obj, peerId, repeaterId) {
    return Promise.resolve().then(() => {
      const msg = JSON.stringify(obj)
      if (this.peers[peerId]) {
        return new Promise((resolve, reject) => {
          this.peers[peerId].ws.send(msg, {}, (err) => {
            if (err) {
              setTimeout(() => {
                this.send(obj, peerId).then(resolve)
              }, SEND_RETRY_INTERVAL)
            } else {
              if (repeaterId) {
                this.peers[peerId].unanswered[repeaterId] = obj
              }
              resolve()
            }
          })
        })
      } else {
        throw new Error('no such peer')
      }
    })
  },

  stopRepeating(peerId, repeaterId) {
    delete this.peers[peerId].unanswered[repeaterId]
  }
}

module.exports = Hubbie
