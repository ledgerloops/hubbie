const Hubbie = require('../src/index')
const assert = require('chai').assert

describe('Hubbie', function () {
  beforeEach(function () {
    this.hubbie1 = new Hubbie();
    this.hubbie2 = new Hubbie();

    this.tasks = {
     send: () => {
        this.hubbie1.send('hubbie2', 'hi there');
        return Promise.resolve();
      }
    };
  });

  afterEach(function () {
    return Promise.all([ this.hubbie1.close(), this.hubbie2.close() ]);
  });

  // topologies
  const makeTopology = (name, senderUp, receiverUp, shouldUsePeerSecrets) => {
    describe(name, function () {
      beforeEach(function () {
        this.tasks['sender-up'] = senderUp.bind(this);
        this.tasks['receiver-up'] = receiverUp.bind(this);
      });

      // last two steps:
      function lastTwoSteps (one, other) {
        describe(`${one} ${other}`, function() {
          beforeEach(function() {
            return this.tasks[one]().then(() => {
              return this.tasks[other]();
            });
          });
          it('should connect', function () {
            return new Promise((resolve) => {
              this.hubbie2.on('peer', ({ peerName, peerSecret }) => {
                assert.strictEqual(peerName, 'hubbie1');
                if (shouldUsePeerSecrets) {
                  assert.strictEqual(peerSecret, 'pssst');
                } else {
                  assert.strictEqual(peerSecret, undefined);
                }
                resolve();
              });
            });
          });
          it('should deliver the message', function () {
            return new Promise((resolve) => {
              this.hubbie2.on('message', (peerName, message) => {
                assert.strictEqual(peerName, 'hubbie1');
                assert.strictEqual(message.toString(), 'hi there');
                resolve();
              });
            });
          });
        });
      }

      function makeSwitchLastTwoSteps (one, other) {
        return function () {
          lastTwoSteps(one, other);
          lastTwoSteps(other, one);
        };
      }

      const onceReceiverIsUp = makeSwitchLastTwoSteps('sender-up', 'send');
      const onceSenderIsUp = makeSwitchLastTwoSteps('receiver-up', 'send');
      const onceSent = makeSwitchLastTwoSteps('receiver-up', 'sender-up');

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

  // in-memory:
  const hubbie1InMem = function () {
    this.hubbie1.listen({ myName: 'hubbie1' });
    return Promise.resolve();
  };
  const hubbie2InMem = function () {
    return this.hubbie2.listen({ myName: 'hubbie2' });
  }
  makeTopology('in-memory', hubbie1InMem, hubbie2InMem, false);

  // server-server (actually this doesn't test full duplex, it only tests hubbie1 in the client role and hubbie2 in the server role):
  const hubbie1SS = function () {
    this.hubbie1.addClient({ myName: 'hubbie1', mySecret: 'pssst', peerName: 'hubbie2', peerUrl: 'http://localhost:8882' });
    return Promise.resolve();
  };
  const hubbie2SS = function () {
    this.hubbie2.listen({ port:8882 });
    return Promise.resolve();
  };
  makeTopology('server-server', hubbie1SS, hubbie2SS, true);

  // client-server with WebSocket:
  const hubbie1WsClient = function () {
    this.hubbie1.addClient({ myName: 'hubbie1', mySecret: 'pssst', peerName: 'hubbie2', peerUrl: 'ws://localhost:8123' });
    return Promise.resolve();
  };
  const hubbie2WsServer = function () {
    return this.hubbie2.listen({ port: 8123 });
  }
  makeTopology('client-server', hubbie1WsClient, hubbie2WsServer, true);
});
