'use strict';

var dgram = require('dgram');
var Promise = require('pinkie-promise');
var tools = require('./tools');

module.exports = function () {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  return new Promise(function (resolve, reject) {
    var socket = dgram.createSocket(options.socket || {});
    var closed = false;

    socket.once('error', function (err) {
      socket.removeAllListeners('error');
      socket.removeAllListeners('listening');
      reject(err);
    });

    socket.once('listening', function () {
      var facade = tools.mixEventEmitter(socket, {
        address: socket.address.bind(socket),
        send: function send() {
          for (var _len = arguments.length, args = Array(_len), _key = 0; _key < _len; _key++) {
            args[_key] = arguments[_key];
          }

          return new Promise(function (resolve, reject) {
            if (closed) {
              return reject(new Error('socket is closed'));
            }
            args.push(function (err) {
              if (err) {
                return reject(err);
              }
              resolve(facade);
            });
            socket.send.apply(socket, args);
          });
        },
        close: function close() {
          return new Promise(function (resolve, reject) {
            // consider the socket as unusable from now on
            closed = true;
            socket.close(function (err) {
              if (err) {
                return reject(err);
              }
              resolve(facade);
            });
          });
        }
      });

      socket.setBroadcast(options.broadcast || false);

      socket.removeAllListeners('error');
      socket.removeAllListeners('listening');

      resolve(facade);
    });

    socket.bind(options.bind || {});
  });
};