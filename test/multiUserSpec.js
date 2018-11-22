const Hubbie = require('../src/index')
const assert = require('chai').assert

function  testerFunction(peerUrl) {
  return function () {
    beforeEach(function () {
      this.hubbie1.addClient({ myName: 'hubbie1', mySecret: 'pssst', peerName: 'hubbie2user', peerUrl });
      this.hubbie2.listen({ port:8882, multiUser: true });
      this.hubbie1.send('hubbie2user', 'hi there');
    });

    it('should trigger the peer event', function () {
      return new Promise((resolve) => {
        this.hubbie2.on('peer', ({ userName, peerName, peerSecret }) => {
          assert.strictEqual(userName, 'hubbie2user');
          assert.strictEqual(peerName, 'hubbie1');
          assert.strictEqual(peerSecret, 'pssst');
          resolve();
        });
      });
    });

    it('should trigger the message event', function () {
      return new Promise((resolve) => {
        this.hubbie2.on('message', (peerName, message, userName) => {
          assert.strictEqual(userName, 'hubbie2user');
          assert.strictEqual(peerName, 'hubbie1');
          assert.strictEqual(message.toString(), 'hi there');
          resolve();
        });
      });
    });
  };
}

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

  describe('listen http multiUser', testerFunction('http://localhost:8882/hubbie2user'));
  describe('listen ws multiUser', testerFunction('ws://localhost:8882/hubbie2user'));

  afterEach(function () {
    return Promise.all([ this.hubbie1.close(), this.hubbie2.close() ]);
  });
});
