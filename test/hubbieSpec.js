const BtpSpider = require('../src/hubbie')
const assert = require('chai').assert

// This is actually testing the
// https://github.com/interlegderjs/btp-packet module:
const TYPE_MESSAGE = 6
const TYPE_RESPONSE = 1

describe('Spider', () => {
  beforeEach(function () {
    this.connectedToServer = []
    this.receivedByServer = []
    this.clientConnectedTo = []
    this.receivedByClient = []
    this.onServerReceive = []
    this.onClientReceive = []
    this.onConnectedToServer = []
    this.onClientConnectedTo = []

    this.server = new BtpSpider({
      listen: 8000
    }, (peerId) => {
      this.connectedToServer.push(peerId)
      this.onConnectedToServer.map(f => f(peerId))
    }, (obj, peerId) => {
      this.receivedByServer.push([ obj, peerId ])
      this.onServerReceive.map(f => f([ obj, peerId ]))
    })

    this.client = new BtpSpider({
      name: 'client',
      upstreams: [
        { url: 'ws://localhost:8000', token: 'asdf' }
      ]
    }, (peerId) => {
      this.clientConnectedTo.push(peerId)
      this.onClientConnectedTo.map(f => f(peerId))
    }, (obj, peerId) => {
      this.receivedByClient.push([obj, peerId])
      this.onClientReceive.map(f => f([ obj, peerId ]))
    })
    this.packet = {
      type: TYPE_MESSAGE,
      requestId: 1,
      data: {
        protocolData: []
      }
    }
    this.responsePacket = {
      type: TYPE_RESPONSE,
      requestId: 1,
      data: {
        protocolData: []
      }
    }
    this.packet2 = {
      type: TYPE_MESSAGE,
      requestId: 2,
      data: {
        protocolData: []
      }
    }
    this.packet3 = {
      type: TYPE_MESSAGE,
      requestId: 3,
      data: {
        protocolData: []
      }
    }
    this.packet4 = {
      type: TYPE_MESSAGE,
      requestId: 4,
      data: {
        protocolData: []
      }
    }
  })

  describe('client starts first', () => {
    beforeEach(function () {
      const clientPromise = this.client.start()
      const serverPromise = this.server.start()
      return Promise.all([ clientPromise, serverPromise ])
    })

    afterEach(function () {
      return Promise.all([ this.client.stop(), this.server.stop() ])
    })

    it('should connect', function () {
      assert.deepEqual(this.connectedToServer, [ 'ws://localhost:8000/client/asdf' ])
      assert.deepEqual(this.clientConnectedTo, [ 'ws://localhost:8000/client/asdf' ])
    })

    it('should send to server', function (done) {
      this.onServerReceive.push((arr) => {
        assert.deepEqual(arr, [ this.packet, 'ws://localhost:8000/client/asdf' ])
        done()
      })
      this.client.send(this.packet, 'ws://localhost:8000/client/asdf', 1)
    })

    it('should send to client', function (done) {
      this.onClientReceive.push((arr) => {
        assert.deepEqual(arr, [ this.packet, 'ws://localhost:8000/client/asdf' ])
        done()
      })
      this.server.send(this.packet, 'ws://localhost:8000/client/asdf', 1)
    })
  })

  describe('server starts first, then restarts', () => {
    beforeEach(function () {
      return this.server.start().then(() => {
        return this.client.start()
      }).then(() => {
        return this.server.stop()
      }).then(() => {
        const clientReconnected = new Promise(resolve => {
          this.onConnectedToServer.push((peerId) => {
            this.client.send(this.packet2, 'ws://localhost:8000/client/asdf', 2).then(() => {
              return this.server.send(this.packet3, 'ws://localhost:8000/client/asdf', 3)
            }).then(resolve)
          })
        })
        return this.server.start().then(clientReconnected)
      })
    })

    afterEach(function () {
      return Promise.all([ this.client.stop(), this.server.stop() ])
    })

    it('should connect', function () {
      assert.deepEqual(this.connectedToServer, [ 'ws://localhost:8000/client/asdf' ])
      assert.deepEqual(this.clientConnectedTo, [ 'ws://localhost:8000/client/asdf' ])
    })

    it('should send to server', function (done) {
      this.onServerReceive.push((arr) => {
        assert.deepEqual(arr, [ this.packet2, 'ws://localhost:8000/client/asdf' ])
        done()
      })
    })

    it('should send to client', function (done) {
      this.onClientReceive.push((arr) => {
        assert.deepEqual(arr, [ this.packet3, 'ws://localhost:8000/client/asdf' ])
        done()
      })
    })
  })

  describe('client reconnects', () => {
    beforeEach(function () {
      return this.server.start().then(() => {
        return this.client.start()
      }).then(() => {
        return this.client.send(this.packet, 'ws://localhost:8000/client/asdf', 1)
      }).then(() => {
        return this.server.send(this.responsePacket, 'ws://localhost:8000/client/asdf', false)
      }).then(() => {
        return this.client.send(this.packet2, 'ws://localhost:8000/client/asdf', 2)
      }).then(() => {
        this.server.send(this.packet3, 'ws://localhost:8000/client/asdf', 3)
      }).then(() => {
        return this.client.stop()
      }).then(() => {
        const clientReconnected = new Promise(resolve => {
          this.onConnectedToServer.push((peerId) => {
            this.client.send(this.packet4, 'ws://localhost:8000/client/asdf', 4).then(resolve)
          })
        })
        return this.client.start().then(() => {
          return clientReconnected
        })
      })
    })

    afterEach(function () {
      return Promise.all([ this.client.stop(), this.server.stop() ])
    })

    it('should connect', function () {
      assert.deepEqual(this.connectedToServer, [ 'ws://localhost:8000/client/asdf', 'ws://localhost:8000/client/asdf' ])
      assert.deepEqual(this.clientConnectedTo, [ 'ws://localhost:8000/client/asdf', 'ws://localhost:8000/client/asdf' ])
    })

    it('should send new messages to server', function (done) {
      this.onServerReceive.push((arr) => {
        assert.deepEqual(arr, [ this.packet4, 'ws://localhost:8000/client/asdf' ])
        done()
      })
    })

    it('should send to client', function () {
      for (let i=0; i < this.receivedByClient.length; i++) {
        if (this.receivedByClient[i][0].requestId == 3) {
          assert.deepEqual(this.receivedByClient[i], [ this.packet3, 'ws://localhost:8000/client/asdf' ])
          return
        }
      }
      throw new Error('packet 3 not received by client')
    })
  })
})
