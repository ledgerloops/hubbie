const Hubbie = require('../src/index')
const assert = require('chai').assert

describe('Hubbie', function () {
  beforeEach(function () {
    this.hubbie1 = new Hubbie();
    this.hubbie2 = new Hubbie();

    this.tasks = {
     send: () => {
        this.hubbie1.send('hubbie2', 'hi there');
      }
    };
  });

  afterEach(function () {
    return Promise.all([ this.hubbie1.stop(), this.hubbie2.stop() ]);
  });

  // topologies
  const makeTopology = (name, senderUp, receiverUp) => {
    describe(name, function () {
      beforeEach(function () {
        this.tasks['sender-up'] = senderUp.bind(this);
        this.tasks['receiver-up'] = receiverUp.bind(this);
      });

      // last two steps:
      const makeLastTwoSteps = function (one, other) {
        return function () {
          describe(`${one} ${other}`, function() {
            beforeEach(function() {
              return this.tasks[one]().then(() => {
                return this.tasks[other]();
              });
            });
            it('should connect', function () {
              return new Promise((resolve) => {
                this.hubbie2.on('peer', ({ peerName, peerSecret }) => {
                  assert.strictEqual(peerName, 'alice');
                  assert.strictEqual(peerSecret, 'pssst');
                  resolve();
                });
              });
            });
             it('should deliver the message', function () {
               return new Promise((resolve) => {
                 this.hubbie2.on('message', (peerName, message) => {
                   assert.strictEqual(peerName, 'alice');
                   assert.strictEqual(message, 'hi there');
                   resolve();
                 });
               });
             });
          });
          describe(`${other} ${one}`, function() {
            beforeEach(function() {
              return this.tasks[other]().then(() => {
                return this.tasks[one]();
              });
            });
            it('should deliver the message', function () {
              assert.strictEqual(this.delivered, true);
            });
          });
        };
      };
      const onceReceiverIsUp = makeLastTwoSteps('sender-up', 'send');
      const onceSenderIsUp = makeLastTwoSteps('receiver-up', 'send');
      const onceSent = makeLastTwoSteps('receiver-up', 'sender-up');

      // three steps:
      const makeThreeSteps = function (firstTask, lastTwoSteps) {
        return function () {
          describe(`${firstTask} first`, function () {
            beforeEach(function () {
              return this.tasks[firstTask]();
            });
            lastTwoSteps();
          });
        };
      };
      const senderUpFirst = makeThreeSteps('sender-up', onceSenderIsUp);
       const receiverUpFirst = makeThreeSteps('receiver-up', onceReceiverIsUp);
       const sentFirst = makeThreeSteps('send', onceSent);

      senderUpFirst();
      receiverUpFirst();
      sentFirst();
    });
  };

  // client-server with WebSocket:
  const hubbie1WsClient = function () {
    this.hubbie1.addClient({ myName: 'alice', mySecret: 'pssst', peerName: 'bob', peerUrl: 'ws://localhost:8123' });
    return Promise.resolve();
  };
  const hubbie2WsServer = function () {
    return this.hubbie2.listen({ port: 8123 });
  }
  makeTopology('client-server', hubbie1WsClient, hubbie2WsServer);
});
