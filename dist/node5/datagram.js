'use strict';

const dgram = require('dgram');
const Promise = require('pinkie-promise');
const tools = require('./tools');

module.exports = function () {
  let options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  return new Promise((resolve, reject) => {
    const socket = dgram.createSocket(options.socket || {});
    const log = options.log || tools.noLog;
    let closed = false;

    socket.once('error', err => {
      log.debug(`[socket] error on creation: ${ err }`);
      socket.removeAllListeners('error');
      socket.removeAllListeners('listening');
      reject(err);
    });

    socket.once('listening', () => {
      const c2s = tools.cnx2str(socket.address());
      log.debug(`[socket ${ c2s }] listening`);

      const facade = tools.mixEventEmitter(socket, {
        address: socket.address.bind(socket),
        send: (msg, port, address) => new Promise((resolve, reject) => {
          if (closed) {
            return reject(new Error('socket is closed'));
          }
          log.debug(`[socket ${ c2s }] sending ${ msg.toString() } to ${ address }:${ port }`);
          socket.send(msg, 0, msg.length, port, address, err => {
            if (err) {
              return reject(err);
            }
            resolve(facade);
          });
        }),
        close: () => new Promise(resolve => {
          // consider the socket as unusable from now on
          closed = true;
          log.debug(`[socket ${ c2s }] closing`);
          socket.once('close', () => resolve(facade));
          socket.close();
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