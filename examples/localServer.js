const Hubbie = require('..');
const userCredentials = {
  alice: 'psst'
};
localServer = new Hubbie();
localServer.listen({
  port: 8000
});

localServer.on('peer', (eventObj) => {
  if (eventObj.peerSecret === userCredentials[eventObj.peerName]) {
    console.log('Accepting connection', eventObj);
    localServer.send(eventObj.peerName, 'Welcome!');
    return true;
  } else {
    console.log('Client rejected');
    return false;
  }
});
localServer.on('message', (peerName, msg) => {
  console.log(`Server sees message from ${peerName}`, msg)
});
setTimeout(() => {
  console.log('Closing server');
  localServer.close();
}, 10000);
