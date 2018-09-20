// singleton:
let hubbies = {};

module.exports = {
  register: function(name, listener) {
    if (typeof channels[name] !== 'undefined') {
      throw new Error('name already taken! ' + name);
    }
    for (let other in hubbies) {
      hubbies[other].channels[name] = {
        send: (msg) => {
          listener.onMessage(other, msg);
        }
      };
      listener.channels[name] = {
        send: (msg) => {
          hubbies[other].onMessage(name, msg);
        }
      };
    }
    hubbies[name] = listener;
  }
};
