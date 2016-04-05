'use strict';

var dgram = require('dgram');
var Promise = require('pinkie-promise');
var tools = require('./tools');

module.exports = function () {
  var options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  return new Promise(function (resolve, reject) {
    var socket = dgram.createSocket(options.socket || {});
    var log = options.log || tools.noLog;
    var closed = false;

    socket.once('error', function (err) {
      log.debug('[socket] error on creation: ' + err);
      socket.removeAllListeners('error');
      socket.removeAllListeners('listening');
      reject(err);
    });

    socket.once('listening', function () {
      var c2s = tools.cnx2str(socket.address());
      log.debug('[socket ' + c2s + '] listening');

      var facade = tools.mixEventEmitter(socket, {
        address: socket.address.bind(socket),
        send: function send(msg, port, address) {
          return new Promise(function (resolve, reject) {
            if (closed) {
              return reject(new Error('socket is closed'));
            }
            log.debug('[socket ' + c2s + '] sending ' + msg.toString() + ' to ' + address + ':' + port);
            socket.send(msg, 0, msg.length, port, address, function (err) {
              if (err) {
                return reject(err);
              }
              resolve(facade);
            });
          });
        },
        close: function close() {
          return new Promise(function (resolve) {
            // consider the socket as unusable from now on
            closed = true;
            log.debug('[socket ' + c2s + '] closing');
            socket.once('close', function () {
              return resolve(facade);
            });
            socket.close();
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