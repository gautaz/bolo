'use strict';

var _slicedToArray = function () { function sliceIterator(arr, i) { var _arr = []; var _n = true; var _d = false; var _e = undefined; try { for (var _i = arr[Symbol.iterator](), _s; !(_n = (_s = _i.next()).done); _n = true) { _arr.push(_s.value); if (i && _arr.length === i) break; } } catch (err) { _d = true; _e = err; } finally { try { if (!_n && _i["return"]) _i["return"](); } finally { if (_d) throw _e; } } return _arr; } return function (arr, i) { if (Array.isArray(arr)) { return arr; } else if (Symbol.iterator in Object(arr)) { return sliceIterator(arr, i); } else { throw new TypeError("Invalid attempt to destructure non-iterable instance"); } }; }();

const Promise = require('pinkie-promise');
const EventEmitter = require('events');
const inspect = require('util').inspect;
const store = require('./store');
const tools = require('./tools');
const announcer = require('./announcer');

const c2s = tools.cnx2str;

module.exports = function () {
  let options = arguments.length <= 0 || arguments[0] === undefined ? {} : arguments[0];
  return Promise.all([announcer({ log: options.log, bind: options.announce }), require('./datagram')({ log: options.log, socket: { type: 'udp4' }, bind: options.bind })]).then(_ref => {
    var _ref2 = _slicedToArray(_ref, 2);

    let announcer = _ref2[0];
    let bolo = _ref2[1];
    return new Promise((resolve, reject) => {
      options.bind = options.bind || {};

      let closed = false;

      const log = options.log || tools.noLog;
      const peerEvents = new EventEmitter();
      const events = new EventEmitter();

      const peers = store(peerEvents);
      const myData = store(events);
      const theirData = store(events);

      const peerUrl = peer => `udp://${ peer.address }:${ peer.port }`;

      const facade = {
        close: () => {
          closed = true;
          return Promise.all(peers.mapData(peer => bolo.send(JSON.stringify({
            bolo: 'quit',
            quit: (options.bind.address ? [options.bind.address] : tools.externalAddresses().map(a => a.address)).map(address => peerUrl({ address: address, port: bolo.address().port })),
            remove: myData.map(key => key)
          }), peer.port, peer.address).catch(error => log.warn(`failed to quit from ${ inspect(peer) } (${ error })`)))).then(() => Promise.all([announcer.close().catch(err => log.warn(`failed to close announcer (${ err })`)), bolo.close().catch(err => log.warn(`failed to close (${ err })`))])).then(() => events.emit('close')).then(() => facade);
        },

        set: (key, datum) => {
          if (closed) {
            Promise.reject(new Error('closed'));
          }
          myData.set(key, datum);
          return Promise.all(peers.mapData(peer => bolo.send(JSON.stringify({
            bolo: 'set',
            set: [{ key: key, datum: datum }]
          }), peer.port, peer.address).catch(err => log.warn(`failed to set ${ key } on ${ inspect(peer) } (${ err })`)))).then(() => facade);
        },

        remove: key => {
          if (closed) {
            Promise.reject(new Error('closed'));
          }
          myData.remove(key);
          return Promise.all(peers.mapData(peer => bolo.send(JSON.stringify({
            bolo: 'remove',
            remove: [key]
          }), peer.port, peer.address).catch(err => log.warn(`failed to remove ${ key } from ${ inspect(peer) } (${ err })`)))).then(() => facade);
        },

        get: function get(key) {
          let options = arguments.length <= 1 || arguments[1] === undefined ? {} : arguments[1];
          return new Promise((resolve, reject) => {
            let timeout = null;
            let askInterval = null;
            const stored = myData.get(key) || theirData.get(key);
            const closeHandler = () => {
              facade.removeListener('set', resolver);
              clearTimeout(timeout);
              clearInterval(askInterval);
              reject(new Error('closed'));
            };
            const resolver = (k, d) => {
              if (k === key) {
                facade.removeListener('set', resolver);
                facade.removeListener('close', closeHandler);
                clearTimeout(timeout);
                clearInterval(askInterval);
                resolve(d);
              }
            };

            if (typeof stored !== 'undefined') {
              return resolve(stored);
            }

            if (closed) {
              reject(new Error('closed'));
            }

            if (options.timeout) {
              timeout = setTimeout(() => {
                facade.removeListener('set', resolver);
                facade.removeListener('close', closeHandler);
                clearInterval(askInterval);
                reject(new Error(`${ key } was not found`));
              }, options.timeout);
            }

            if (options.askInterval) {
              askInterval = setInterval(() => {
                peers.mapData(peer => bolo.send(JSON.stringify({
                  bolo: 'ask',
                  ask: [key]
                }), peer.port, peer.address).catch(error => log.warn(`failed to ask for ${ key } (${ error })`)));
              }, options.askInterval);
            }

            facade.on('close', closeHandler);
            facade.on('set', resolver);
          });
        }
      };

      const checkPeer = peer => {
        const url = peerUrl(peer);
        if (!peers.get(url)) {
          peers.set(url, peer);
        }
      };

      const messageHandler = {
        quit: (message, rinfo) => {
          message.quit.forEach(peers.remove);
          message.remove.forEach(theirData.remove);
        },

        set: (message, rinfo) => {
          checkPeer(rinfo);
          message.set.map(_ref3 => {
            let key = _ref3.key;
            let datum = _ref3.datum;
            return theirData.set(key, datum);
          });
        },

        remove: (message, rinfo) => {
          checkPeer(rinfo);
          message.remove.map(key => theirData.remove(key));
        },

        ask: (message, rinfo) => {
          const foundData = message.ask.map(key => ({ key: key, datum: myData.get(key) })).filter(_ref4 => {
            let key = _ref4.key;
            let datum = _ref4.datum;
            return typeof datum !== 'undefined';
          });

          checkPeer(rinfo);
          if (foundData.length) {
            bolo.send(JSON.stringify({
              bolo: 'set',
              set: foundData
            }, rinfo.port, rinfo.address)).catch(error => log.warn(`failed to reply on demand for ${ message.ask } (${ error })`));
          }
        }
      };

      log.info(`listening on ${ bolo.address().address }:${ bolo.address().port }`);

      tools.mixEventEmitter(events, facade);

      peerEvents.on('set', (peerUrl, peer) => {
        log.info(`new peer ${ peerUrl } ${ inspect(peer) }`);
        bolo.send(JSON.stringify({
          bolo: 'set',
          set: myData.map(key => ({ key: key, datum: myData.get(key) }))
        }), peer.port, peer.address).then(() => log.debug(`[bolo] own data sent to ${ c2s(peer) }`)).catch(err => log.warn(`failed to send own data to ${ c2s(peer) } (${ err })`));
      });

      announcer.on('peer', peer => {
        peers.set(peerUrl(peer), peer);
      });
      announcer.on('error', events.emit.bind(events, 'error'));
      announcer.on('close', () => {
        log.info('announcer closed');
      });

      bolo.on('error', events.emit.bind(events, 'error'));
      bolo.on('message', (msg, rinfo) => {
        log.debug(`[bolo] received ${ msg.toString() } from ${ c2s(rinfo) }`);
        try {
          const message = JSON.parse(msg);
          messageHandler[message.bolo](message, rinfo);
        } catch (error) {
          log.warn(`malformed message (${ msg.toString() }) from ${ rinfo.address }:${ rinfo.port } (${ error })`);
        }
      });
      bolo.on('close', () => {
        log.info('closed');
      });

      announcer.announce({
        address: options.bind.address,
        port: bolo.address().port
      }).then(() => resolve(facade), reject);
    });
  });
};