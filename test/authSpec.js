const Hubbie = require('../src/index')
const assert = require('chai').assert

describe('Hubbie', function () {
  beforeEach(function () {
    this.hubbie1 = new Hubbie();
    this.hubbie2 = new Hubbie();
  });

  afterEach(function () {
    return Promise.all([ this.hubbie1.close(), this.hubbie2.close() ]);
  });
 
  function tests(peerUrl) {
    return function() {
      beforeEach(function () {
        this.hubbie2.listen({ port:8882 });
      });
      it('can connect with ok creds', function (done) {
        this.hubbie1.addClient({ myName: 'hubbie1', mySecret: 'pssst', peerName: 'hubbie2ok', peerUrl });
        this.hubbie1.send('hubbie2ok', 'hi there');
        this.hubbie2.on('peer', (eventObj) => {
          assert.equal(eventObj.peerName, 'hubbie1');
          assert.equal(eventObj.peerSecret, 'pssst');
          return eventObj.peerSecret === 'pssst';
        });
        this.hubbie2.on('message', (peerName, message, userName) => {
          assert.equal(peerName, 'hubbie1');
          assert.equal(message, 'hi there');
          assert.equal(userName, undefined);
          done();
        });
        this.hubbie2.on('error', done);
      });
      it('cannot connect with wrong creds', function (done) {
        this.hubbie1.addClient({ myName: 'hubbie1', mySecret: 'zzz', peerName: 'hubbie2wrong', peerUrl });
        this.hubbie1.send('hubbie2wrong', 'hi there');
        this.hubbie2.on('peer', (eventObj) => {
          assert.equal(eventObj.peerName, 'hubbie1');
          assert.equal(eventObj.peerSecret, 'zzz');
          return eventObj.peerSecret === 'pssst';
        });
        this.hubbie2.on('message', (peerName, message, userName) => {
          done(new Error('message arrived and should not have'));
        });
        this.hubbie2.on('error', (err) => {
          assert.equal(err.message, 'wrong creds');
          done();
        });
      });
    };
  }
 
  describe('http', tests('http://localhost:8882'));
  describe('ws', tests('ws://localhost:8882'));
});
