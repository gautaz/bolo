'use strict';

const dgram = require('dgram');
const Promise = require('pinkie-promise');
const tools = require('./tools');

module.exports = function () {
  let options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket(options.socket || {});
    let closed = false;

    socket.once('error', err => {
      socket.removeAllListeners('error');
      socket.removeAllListeners('listening');
      reject(err);
    });

    socket.once('listening', () => {
      const facade = tools.mixEventEmitter(socket, {
        address: socket.address.bind(socket),
        send: function send() {
          for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }

          return new Promise((resolve, reject) => {
            if (closed) {
              return reject(new Error('socket is closed'));
            }
            args.push(err => {
              if (err) {
                return reject(err);
              }
              resolve(facade);
            });
            socket.send.apply(socket, args);
          });
        },
        close: () => new Promise((resolve, reject) => {
          // consider the socket as unusable from now on
          closed = true;
          socket.close(err => {
            if (err) {
              return reject(err);
            }
            resolve(facade);
          });
        })
      });

      socket.setBroadcast(options.broadcast || false);

      socket.removeAllListeners('error');
      socket.removeAllListeners('listening');

      resolve(facade);
    });

    socket.bind(options.bind || {});
  });
};